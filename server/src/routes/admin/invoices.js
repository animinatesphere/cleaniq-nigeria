// Admin → Invoices and Payment link. Pay-after, weekly and monthly-plan invoices are made automatically;
// admin can also make one (a payment link is a quick one-line invoice), resend, mark paid or cancel.
const express = require("express");
const Invoice = require("../../models/Invoice");
const Booking = require("../../models/Booking");
const inv = require("../../lib/invoices");
const { getPricingSettings, getSetting, setSetting } = require("../../lib/settings");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { clean, isEmail, normaliseEmail } = require("../../lib/text");
const { isValidDate, lagosDate, addDays } = require("../../lib/time");
const { round2 } = require("../../lib/money");
const { badRequest, notFound } = require("../../middleware/errors");

const KINDS = ["payAfter", "weekly", "subscription", "link", "manual"];
const OFFLINE_METHODS = ["Cash", "Bank transfer", "POS"];

module.exports = function adminInvoiceRoutes(ctx) {
  const router = express.Router();
  const managers = ctx.auth.requireAdmin("owner", "manager");

  const load = async (no) => {
    const doc = await Invoice.findOne({ invoiceNo: String(no) });
    if (!doc) throw notFound("Invoice not found");
    return doc;
  };

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["invoiceNo", "customer.name", "customer.email", "customer.phone", "lines.bookingId"]);
    if (["Unpaid", "Paid", "Cancelled"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.status === "Overdue") Object.assign(filter, { status: "Unpaid", dueDate: { $lt: lagosDate() } });
    if (KINDS.includes(req.query.kind)) filter.kind = req.query.kind;
    if (req.query.kinds) filter.kind = { $in: String(req.query.kinds).split(",").filter((k) => KINDS.includes(k)) };
    const base = filter.kind ? { kind: filter.kind } : {};
    const [items, total, sums, overdue] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([{ $match: base }, { $group: { _id: "$status", total: { $sum: "$total" }, n: { $sum: 1 } } }]),
      Invoice.aggregate([{ $match: { ...base, status: "Unpaid", dueDate: { $lt: lagosDate() } } }, { $group: { _id: null, total: { $sum: "$total" }, n: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(sums.map((s) => [s._id, { count: s.n, value: round2(s.total) }]));
    counts.Overdue = { count: overdue[0]?.n || 0, value: round2(overdue[0]?.total || 0) };
    res.json({ items, total, page, limit, counts });
  });

  router.get("/billing-settings", async (req, res) => res.json({ billing: await inv.billingSettings() }));
  router.put("/billing-settings", managers, async (req, res) => {
    const payAfterDays = Math.floor(Number(req.body?.payAfterDays));
    const weeklyBillingDay = Math.floor(Number(req.body?.weeklyBillingDay));
    if (!(payAfterDays >= 0 && payAfterDays <= 14)) throw badRequest("Pay-after days must be 0–14");
    if (!(weeklyBillingDay >= 0 && weeklyBillingDay <= 6)) throw badRequest("Choose a day of the week");
    const billing = await setSetting("billing", { ...((await getSetting("billing")) || {}), payAfterDays, weeklyBillingDay });
    await logAdmin(req, "billing.settings", "billing", billing);
    res.json({ billing });
  });

  // Run a billing job now (normally automatic).
  router.post("/run/:job", managers, async (req, res) => {
    const jobs = { weekly: () => inv.runWeeklyBilling(ctx), subscriptions: () => inv.runSubscriptionBilling(ctx), reminders: () => inv.sendOverdueReminders(ctx) };
    const fn = jobs[req.params.job];
    if (!fn) throw notFound();
    const done = await fn();
    await logAdmin(req, `billing.run.${req.params.job}`, req.params.job, { done });
    res.json({ done });
  });

  // Make an invoice / payment link. Body: { kind: link|manual, customer{name,email,phone}, lines[{description,qty,unitPrice}], dueDate, addVat, bookingIds[], note, send }
  router.post("/", async (req, res) => {
    const b = req.body || {};
    const errors = {};
    const kind = b.kind === "link" ? "link" : "manual";
    const customer = { name: clean(b.customer?.name, 80), email: normaliseEmail(b.customer?.email), phone: clean(b.customer?.phone, 30) };
    if (!customer.name) errors.name = "Enter the customer's name";
    if (!isEmail(customer.email)) errors.email = "Enter a valid email";
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 30).map((l) => ({ description: clean(l?.description, 200), qty: Math.floor(Number(l?.qty) || 1), unitPrice: round2(Number(l?.unitPrice)) }));
    if (!lines.length || lines.some((l) => !l.description || !(l.unitPrice > 0) || l.qty < 1 || l.qty > 1000)) errors.lines = "Each line needs a description and an amount above ₦0";
    const dueDate = b.dueDate ? String(b.dueDate) : addDays(lagosDate(), kind === "link" ? 0 : 7);
    if (!isValidDate(dueDate)) errors.dueDate = "Choose a valid due date";
    let bookings = [];
    if (Array.isArray(b.bookingIds) && b.bookingIds.length) {
      bookings = await Booking.find({ bookingId: { $in: b.bookingIds.map(String).slice(0, 50) } });
      if (bookings.some((x) => x.payment.invoice || x.payment.status !== "Pending")) errors.bookingIds = "A chosen booking is already paid or on another invoice";
    }
    if (Object.keys(errors).length) throw badRequest("Please check the invoice", errors);
    const { vat } = await getPricingSettings();
    const doc = await inv.createInvoice({
      kind, customer, lines, dueDate, vat: b.addVat ? { ...vat, enabled: true } : undefined,
      bookings: bookings.map((x) => x._id), note: clean(b.note, 500), createdBy: req.admin.name,
    });
    if (bookings.length) await Booking.updateMany({ _id: { $in: doc.bookings }, "payment.invoice": null }, { $set: { "payment.invoice": doc._id } });
    await inv.ensureCheckout(ctx, doc);
    if (b.send !== false) await inv.sendInvoice(ctx, doc);
    await logAdmin(req, `invoice.create`, doc.invoiceNo, { kind, total: doc.total });
    res.status(201).json({ invoice: await Invoice.findById(doc._id) });
  });

  router.get("/:no", async (req, res) => {
    const doc = await Invoice.findOne({ invoiceNo: String(req.params.no) }).populate("bookings", "bookingId service schedule status payment.status").lean();
    if (!doc) throw notFound("Invoice not found");
    res.json({ invoice: doc });
  });

  router.post("/:no/send", async (req, res) => {
    const doc = await load(req.params.no);
    if (doc.status !== "Unpaid") throw badRequest(`This invoice is ${doc.status.toLowerCase()}`);
    await inv.sendInvoice(ctx, doc, { reminder: Boolean(doc.sentAt) });
    await logAdmin(req, "invoice.send", doc.invoiceNo);
    res.json({ invoice: await Invoice.findById(doc._id) });
  });

  router.post("/:no/mark-paid", managers, async (req, res) => {
    const doc = await load(req.params.no);
    const method = OFFLINE_METHODS.includes(req.body?.method) ? req.body.method : null;
    if (!method) throw badRequest("Choose how it was paid");
    const r = await inv.markInvoicePaid(doc._id, { method, note: clean(req.body?.note, 300), by: req.admin.name });
    if (r.result !== "paid") throw badRequest("This invoice isn't waiting for payment");
    await logAdmin(req, "invoice.markPaid", doc.invoiceNo, { method, total: doc.total });
    res.json({ invoice: r.invoice });
  });

  router.post("/:no/cancel", managers, async (req, res) => {
    const doc = await Invoice.findOneAndUpdate({ invoiceNo: String(req.params.no), status: "Unpaid" }, { $set: { status: "Cancelled", note: clean(req.body?.reason, 300) || undefined } }, { new: true });
    if (!doc) throw badRequest("Only unpaid invoices can be cancelled");
    // Free the bookings so they can be billed again.
    await Booking.updateMany({ _id: { $in: doc.bookings }, "payment.invoice": doc._id }, { $set: { "payment.invoice": null } });
    await logAdmin(req, "invoice.cancel", doc.invoiceNo);
    res.json({ invoice: doc });
  });

  return router;
};
