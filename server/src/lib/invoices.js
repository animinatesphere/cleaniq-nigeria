// Invoices: pay-after cleans (due the day after), weekly bills, monthly plan payments, payment links.
// Paid through a Paystack link (confirmed by the webhook, once) or marked paid by admin.
const crypto = require("crypto");
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const { layout, detailsTable } = require("./email");
const { round2, toKobo, fromKobo, formatNaira } = require("./money");
const { lagosDate, addDays, formatLagosDate } = require("./time");
const { escapeHtml } = require("./text");
const { getSetting } = require("./settings");
const { getAutomations, getSmsSettings, fill } = require("./automations");

const BILLING_DEFAULTS = { payAfterDays: 1, weeklyBillingDay: 1 }; // Monday
async function billingSettings() {
  return { ...BILLING_DEFAULTS, ...((await getSetting("billing")) || {}) };
}

async function newInvoiceNo() {
  for (let i = 0; i < 10; i++) {
    const no = `INV-${crypto.randomInt(100000, 1000000)}`;
    if (!(await Invoice.exists({ invoiceNo: no }))) return no;
  }
  throw new Error("Could not create an invoice number");
}

function invoiceEmail(config, inv, { reminder = false } = {}) {
  const rows = inv.lines.map((l) => [`${l.description}${l.qty > 1 ? ` × ${l.qty}` : ""}`, formatNaira(l.amount)]);
  if (inv.vat?.enabled && inv.vat.amount) rows.push([`${inv.vat.label} (${inv.vat.rate}%)`, formatNaira(inv.vat.amount)]);
  rows.push(["Total", formatNaira(inv.total)]);
  const due = inv.dueDate ? formatLagosDate(inv.dueDate) : "on receipt";
  return {
    subject: `${reminder ? "Reminder: " : ""}Invoice ${inv.invoiceNo} — ${formatNaira(inv.total)}${reminder ? " is due" : ""}`,
    type: reminder ? "invoice-reminder" : "invoice",
    html: layout(config, {
      title: reminder ? "A friendly reminder" : "Your invoice",
      intro: `Hi ${escapeHtml(inv.customer?.name?.split(" ")[0] || "there")}, ${reminder ? "this invoice is still waiting to be paid." : "thank you for choosing Cleaniq."} It's due <strong>${escapeHtml(due)}</strong>.`,
      bodyHtml: detailsTable(rows) + detailsTable([["Invoice", inv.invoiceNo], ["Due", due]]),
      button: inv.paystack?.url ? { url: inv.paystack.url, label: `Pay ${formatNaira(inv.total)}` } : undefined,
    }),
  };
}

// Paystack checkout for the invoice (made once, reused for reminders).
async function ensureCheckout({ config, paystack }, inv) {
  if (inv.paystack?.url) return inv;
  if (!inv.customer?.email) throw Object.assign(new Error("This invoice has no email to send a payment link to"), { status: 400 });
  const reference = `${inv.invoiceNo}-${crypto.randomBytes(4).toString("hex")}`;
  const tx = await paystack.initialize({
    email: inv.customer.email,
    amountKobo: toKobo(inv.total),
    reference,
    callbackUrl: `${config.frontendUrl}/payment/success?invoice=${inv.invoiceNo}&reference=${reference}`,
    metadata: { invoiceNo: inv.invoiceNo, kind: inv.kind },
  });
  inv.paystack = { reference, url: tx.authorization_url };
  await inv.save();
  return inv;
}

async function sendInvoice(ctx, inv, opts = {}) {
  await ensureCheckout(ctx, inv);
  const r = await ctx.mailer.send({ to: inv.customer.email, ref: inv.invoiceNo, ...invoiceEmail(ctx.config, inv, opts) });
  if (!opts.reminder) await Invoice.updateOne({ _id: inv._id }, { $set: { sentAt: new Date() } });
  const text = await getSmsSettings();
  if (ctx.sms && text.enabled && text.invoiceIssued && inv.customer?.phone) {
    await ctx.sms.send(inv.customer.phone, fill(text.templates.invoice, { firstName: inv.customer.name?.split(" ")[0] || "there", ref: inv.invoiceNo, amount: formatNaira(inv.total), date: inv.dueDate ? formatLagosDate(inv.dueDate) : "now", link: inv.paystack?.url || "" }));
  }
  return r;
}

/** Creates an invoice. lines: [{ description, qty, unitPrice, bookingId? }]. */
async function createInvoice({ _id, kind, customer, customerId, lines, dueDate, period, bookings = [], subscription, vat, note, createdBy }) {
  const clean = lines.map((l) => {
    const qty = Math.max(1, Math.floor(Number(l.qty) || 1));
    const unitPrice = round2(Number(l.unitPrice) || 0);
    return { description: String(l.description).slice(0, 200), qty, unitPrice, amount: round2(qty * unitPrice), bookingId: l.bookingId };
  });
  const subtotal = round2(clean.reduce((s, l) => s + l.amount, 0));
  const vatAmount = vat?.enabled ? round2((subtotal * vat.rate) / 100) : 0;
  return Invoice.create({
    ...(_id ? { _id } : {}),
    invoiceNo: await newInvoiceNo(), kind, customer, customerId, lines: clean, subtotal,
    vat: { enabled: Boolean(vat?.enabled), rate: vat?.rate || 0, label: vat?.label || "VAT", amount: vatAmount },
    total: round2(subtotal + vatAmount), dueDate, period, bookings, subscription, note, createdBy,
  });
}

/** Invoice for one or more bookings (pay-after, weekly). Bookings get linked so they're never billed twice. */
async function invoiceBookings(ctx, bookings, { invoiceId, kind, dueDate, period, createdBy, send = true }) {
  const first = bookings[0];
  const inv = await createInvoice({
    _id: invoiceId, kind,
    customer: { name: `${first.customer.firstName || ""} ${first.customer.lastName || ""}`.trim(), email: first.customer.email, phone: first.customer.phone },
    customerId: first.customerId,
    lines: bookings.map((b) => ({ description: `${b.service} — ${formatLagosDate(b.schedule?.date)} (${b.bookingId})`, qty: 1, unitPrice: b.payment.amount, bookingId: b.bookingId })),
    dueDate, period, bookings: bookings.map((b) => b._id), createdBy,
  });
  // Link atomically; any booking already on another invoice is left out.
  await Booking.updateMany({ _id: { $in: inv.bookings }, "payment.invoice": { $in: [null, inv._id] } }, { $set: { "payment.invoice": inv._id, "payment.dueDate": dueDate } });
  if (send) await sendInvoice(ctx, inv);
  return inv;
}

/** A pay-after clean has just been completed: bill it, due N days later. */
async function billPayAfterBooking(ctx, booking) {
  if (booking.payment?.plan !== "payAfter" || booking.payment.status !== "Pending" || booking.payment.invoice) return null;
  if (!(await getAutomations()).payAfterInvoice) return null;
  const invoiceId = new mongoose.Types.ObjectId();
  const claimed = await Booking.findOneAndUpdate({ _id: booking._id, "payment.invoice": null, "payment.status": "Pending" }, { $set: { "payment.invoice": invoiceId } }, { new: true });
  if (!claimed) return null; // already billed
  const { payAfterDays } = await billingSettings();
  return invoiceBookings(ctx, [claimed], { invoiceId, kind: "payAfter", dueDate: addDays(lagosDate(), payAfterDays), createdBy: "system" });
}

/** Weekly billing: last week's (Mon–Sun) completed weekly-plan cleans, one invoice per customer. */
async function runWeeklyBilling(ctx, now = new Date()) {
  const today = lagosDate(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const { weeklyBillingDay } = await billingSettings();
  if (dow !== Number(weeklyBillingDay)) return 0;
  const lastMonday = addDays(today, -((dow + 6) % 7) - 7);
  const lastSunday = addDays(lastMonday, 6);
  const due = await Booking.find({
    "payment.plan": "weekly", "payment.status": "Pending", "payment.invoice": null, status: "Completed",
    "schedule.date": { $gte: lastMonday, $lte: lastSunday },
  }).sort({ "schedule.date": 1 });
  const byCustomer = new Map();
  for (const b of due) {
    const k = String(b.customer.email || "").toLowerCase();
    if (!byCustomer.has(k)) byCustomer.set(k, []);
    byCustomer.get(k).push(b);
  }
  let made = 0;
  for (const list of byCustomer.values()) {
    await invoiceBookings(ctx, list, { kind: "weekly", dueDate: addDays(today, 2), period: { from: lastMonday, to: lastSunday }, createdBy: "system" });
    made++;
  }
  return made;
}

const addMonths = (dateStr, n) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, Math.min(d, 28)));
  return x.toISOString().slice(0, 10);
};

/** Bill one monthly plan for the month starting on its next billing date (once per month). */
async function billSubscription(ctx, sub, { createdBy = "system", send = true } = {}) {
  const month = (sub.nextBillingDate || lagosDate()).slice(0, 7);
  const existing = await Invoice.findOne({ subscription: sub._id, "period.month": month, status: { $ne: "Cancelled" } });
  if (existing) return existing;
  const inv = await createInvoice({
    kind: "subscription",
    customer: { name: sub.customerName, email: sub.customerEmail, phone: sub.customerPhone },
    customerId: sub.customer,
    lines: [{ description: `${sub.service || "Cleaning"} plan — ${sub.plan?.cleans || ""} clean${sub.plan?.cleans === 1 ? "" : "s"} per ${sub.plan?.per || "month"} (${month})`, qty: 1, unitPrice: sub.monthlyPrice }],
    dueDate: sub.nextBillingDate || lagosDate(),
    period: { month },
    subscription: sub._id,
    createdBy,
  });
  await Subscription.updateOne({ _id: sub._id }, { $set: { status: "payment_due", nextBillingDate: addMonths(sub.nextBillingDate || lagosDate(), 1) } });
  if (send && inv.customer?.email) await sendInvoice(ctx, inv);
  return inv;
}

async function runSubscriptionBilling(ctx, now = new Date()) {
  const today = lagosDate(now);
  const due = await Subscription.find({ status: { $in: ["active", "payment_due"] }, nextBillingDate: { $lte: today } });
  for (const s of due) await billSubscription(ctx, s);
  return due.length;
}

/** Overdue invoices: reminder the day after it's due, then 3 days after (max 2). */
async function sendOverdueReminders(ctx, now = new Date()) {
  const today = lagosDate(now);
  const list = await Invoice.find({ status: "Unpaid", dueDate: { $lt: today }, reminders: { $lt: 2 } });
  let sent = 0;
  for (const inv of list) {
    const waitDays = inv.reminders === 0 ? 1 : 3;
    if (addDays(inv.dueDate, waitDays) > today) continue;
    const claimed = await Invoice.findOneAndUpdate({ _id: inv._id, reminders: inv.reminders }, { $inc: { reminders: 1 }, $set: { lastReminderAt: now } }, { new: true });
    if (!claimed) continue;
    await sendInvoice(ctx, claimed, { reminder: true });
    sent++;
  }
  return sent;
}

/** Paystack said an invoice was paid (webhook / verify). Once only. */
async function confirmInvoicePayment(tx) {
  const reference = String(tx?.reference || "");
  const inv = reference ? await Invoice.findOne({ "paystack.reference": reference }) : null;
  if (!inv) return { result: "unknown-reference" };
  if (Number(tx.amount) !== toKobo(inv.total) || String(tx.currency || "").toUpperCase() !== "NGN") {
    await Payment.updateOne({ reference }, { $setOnInsert: { reference, bookingId: inv.invoiceNo, amount: fromKobo(tx.amount), currency: tx.currency, status: "mismatch", email: inv.customer?.email } }, { upsert: true });
    return { result: "amount-mismatch" };
  }
  const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
  return markInvoicePaid(inv._id, { method: "Paystack", channel: String(tx.channel || ""), reference, paidAt });
}

async function markInvoicePaid(invoiceId, { method, channel = "", reference, paidAt = new Date(), note = "", by }) {
  const inv = await Invoice.findOneAndUpdate({ _id: invoiceId, status: "Unpaid" }, { $set: { status: "Paid", paidAt, method, ...(note ? { note } : {}) } }, { new: true });
  if (!inv) return { result: "already-processed" };
  await Booking.updateMany({ _id: { $in: inv.bookings }, "payment.status": "Pending" }, {
    $set: { "payment.status": "Paid", "payment.paidAt": paidAt, "payment.method": method, "payment.channel": channel, ...(method !== "Paystack" ? { "payment.offline": { method, note, by } } : {}) },
  });
  if (inv.subscription) await Subscription.updateOne({ _id: inv.subscription, status: "payment_due" }, { $set: { status: "active" } });
  const ref = reference || `${inv.invoiceNo}-${method.replace(/\s+/g, "").toUpperCase()}`;
  await Payment.updateOne({ reference: ref }, { $setOnInsert: { reference: ref, bookingId: inv.invoiceNo, subscription: inv.subscription, amount: inv.total, currency: "NGN", status: "success", channel: channel || method, paidAt, email: inv.customer?.email } }, { upsert: true });
  return { result: "paid", invoice: inv };
}

module.exports = {
  billingSettings, createInvoice, invoiceBookings, sendInvoice, ensureCheckout, billPayAfterBooking, runWeeklyBilling,
  billSubscription, runSubscriptionBilling, sendOverdueReminders, confirmInvoicePayment, markInvoicePaid, invoiceEmail, addMonths,
};
