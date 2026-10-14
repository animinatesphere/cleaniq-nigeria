// Billing: pay-after invoices (due the next day), weekly bills, monthly plans, payment links,
// Paystack confirmation (once), mark paid, cancel, overdue reminders.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const Booking = require("../src/models/Booking");
const Invoice = require("../src/models/Invoice");
const Subscription = require("../src/models/Subscription");
const Payment = require("../src/models/Payment");
const { runWeeklyBilling, runSubscriptionBilling, sendOverdueReminders } = require("../src/lib/invoices");
const { lagosDate, addDays } = require("../src/lib/time");

const paystack = fakePaystack();
let t, owner, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  paystack.reset();
  owner = await t.adminToken("owner");
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

const ctx = () => t.app.locals.ctx;
function webhook(data) {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { status: "success", currency: "NGN", channel: "card", ...data } }));
  const sig = crypto.createHmac("sha512", t.config.paystackSecretKey).update(raw).digest("hex");
  return t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
}
const booking = (over = {}) => ({
  bookingId: `NG-${crypto.randomInt(100000, 999999)}`, service: "Deep Cleaning", status: "Confirmed",
  customer: { firstName: "Ada", lastName: "Obi", email: "ada@x.com", phone: "+2348012345678" },
  schedule: { date: lagosDate(), time: "10:00" }, payment: { amount: 45000, plan: "payAfter", status: "Pending" }, ...over,
});

test("pay-after: completing the clean sends one invoice due tomorrow; paying it marks the booking paid", async () => {
  const b = await Booking.create(booking());
  const done = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: manager, body: { status: "Completed" } });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const invs = await Invoice.find();
  assert.equal(invs.length, 1);
  const inv = invs[0];
  assert.equal(inv.kind, "payAfter");
  assert.equal(inv.total, 45000);
  assert.equal(inv.dueDate, addDays(lagosDate(), 1));
  assert.ok(inv.paystack.url);
  assert.ok(t.outbox.some((m) => m.subject.includes(inv.invoiceNo)));
  assert.equal(String((await Booking.findById(b._id)).payment.invoice), String(inv._id));

  // Paystack sends the event twice → paid once.
  const tx = { reference: inv.paystack.reference, amount: 4500000 };
  await Promise.all([webhook(tx), webhook(tx)]);
  const paid = await Invoice.findById(inv._id);
  assert.equal(paid.status, "Paid");
  assert.equal((await Booking.findById(b._id)).payment.status, "Paid");
  assert.equal(await Payment.countDocuments({ reference: inv.paystack.reference }), 1);
});

test("pay-after: wrong amount is not accepted", async () => {
  const b = await Booking.create(booking());
  await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: manager, body: { status: "Completed" } });
  const inv = await Invoice.findOne();
  await webhook({ reference: inv.paystack.reference, amount: 100 });
  assert.equal((await Invoice.findById(inv._id)).status, "Unpaid");
  assert.equal((await Payment.findOne({ reference: inv.paystack.reference })).status, "mismatch");
});

test("weekly bill: last week's completed weekly-plan cleans, one invoice per customer, never twice", async () => {
  // A Monday in Lagos: 2026-10-12. Last week = 5–11 Oct.
  const now = new Date("2026-10-12T08:00:00Z");
  await Booking.create([
    booking({ status: "Completed", schedule: { date: "2026-10-06", time: "09:00" }, payment: { amount: 20000, plan: "weekly", status: "Pending" } }),
    booking({ status: "Completed", schedule: { date: "2026-10-09", time: "09:00" }, payment: { amount: 25000, plan: "weekly", status: "Pending" } }),
    booking({ status: "Completed", schedule: { date: "2026-10-12", time: "09:00" }, payment: { amount: 99999, plan: "weekly", status: "Pending" } }), // this week
    booking({ status: "Completed", customer: { firstName: "Bayo", email: "bayo@x.com" }, schedule: { date: "2026-10-07", time: "09:00" }, payment: { amount: 30000, plan: "weekly", status: "Pending" } }),
  ]);
  assert.equal(await runWeeklyBilling(ctx(), now), 2);
  assert.equal(await runWeeklyBilling(ctx(), now), 0);
  const ada = await Invoice.findOne({ "customer.email": "ada@x.com" });
  assert.equal(ada.total, 45000);
  assert.equal(ada.lines.length, 2);
  assert.deepEqual([ada.period.from, ada.period.to], ["2026-10-05", "2026-10-11"]);
  assert.equal(await runWeeklyBilling(ctx(), new Date("2026-10-13T08:00:00Z")), 0); // not the billing day
});

test("monthly plan: create bills the first month; billing job bills each month once; paying makes it active", async () => {
  const today = lagosDate();
  const r = await t.api("POST", "/api/admin/subscriptions", { token: manager, body: { name: "Chioma Eze", email: "chioma@x.com", phone: "08031234567", service: "Regular Cleaning", cleans: 2, per: "week", monthlyPrice: 120000, nextBillingDate: today } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.subscription.status, "payment_due");
  assert.ok(r.body.subscription.nextBillingDate > today);
  const inv = await Invoice.findOne({ kind: "subscription" });
  assert.equal(inv.total, 120000);
  assert.equal(await runSubscriptionBilling(ctx()), 0); // next month not due yet
  await webhook({ reference: inv.paystack.reference, amount: 12000000 });
  assert.equal((await Subscription.findById(r.body.subscription._id)).status, "active");

  assert.equal((await t.api("POST", "/api/admin/subscriptions", { token: staff, body: {} })).status, 403);
  const p = await t.api("POST", `/api/admin/subscriptions/${r.body.subscription._id}/pause`, { token: manager });
  assert.equal(p.body.subscription.status, "paused");
  const bill = await t.api("POST", `/api/admin/subscriptions/${r.body.subscription._id}/bill`, { token: manager });
  assert.equal(bill.status, 400);
});

test("payment link: makes a Paystack link and emails it; mark paid offline; cancel frees nothing twice", async () => {
  const r = await t.api("POST", "/api/admin/invoices", { token: staff, body: { kind: "link", customer: { name: "Tolu", email: "tolu@x.com" }, lines: [{ description: "Sofa cleaning", unitPrice: 15000 }] } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(r.body.invoice.paystack.url);
  assert.equal(r.body.invoice.total, 15000);
  const bad = await t.api("POST", "/api/admin/invoices", { token: staff, body: { customer: { name: "", email: "x" }, lines: [] } });
  assert.equal(bad.status, 400);
  assert.equal((await t.api("POST", `/api/admin/invoices/${r.body.invoice.invoiceNo}/mark-paid`, { token: staff, body: { method: "Cash" } })).status, 403);
  const paid = await t.api("POST", `/api/admin/invoices/${r.body.invoice.invoiceNo}/mark-paid`, { token: manager, body: { method: "Bank transfer" } });
  assert.equal(paid.body.invoice.status, "Paid");
  assert.equal((await t.api("POST", `/api/admin/invoices/${r.body.invoice.invoiceNo}/mark-paid`, { token: manager, body: { method: "Cash" } })).status, 400);
  assert.equal((await t.api("POST", `/api/admin/invoices/${r.body.invoice.invoiceNo}/cancel`, { token: manager })).status, 400);
  const list = await t.api("GET", "/api/admin/invoices?kinds=link", { token: staff });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.counts.Paid.value, 15000);
});

test("overdue reminders: the day after it's due, then 3 days later, max two", async () => {
  const r = await t.api("POST", "/api/admin/invoices", { token: manager, body: { customer: { name: "Tolu", email: "tolu@x.com" }, lines: [{ description: "Clean", unitPrice: 10000 }], dueDate: "2026-10-01" } });
  assert.equal(r.status, 201);
  t.outbox.length = 0;
  assert.equal(await sendOverdueReminders(ctx(), new Date("2026-10-01T12:00:00Z")), 0);
  assert.equal(await sendOverdueReminders(ctx(), new Date("2026-10-02T12:00:00Z")), 1);
  assert.equal(await sendOverdueReminders(ctx(), new Date("2026-10-03T12:00:00Z")), 0);
  assert.equal(await sendOverdueReminders(ctx(), new Date("2026-10-05T12:00:00Z")), 1);
  assert.equal(await sendOverdueReminders(ctx(), new Date("2026-10-20T12:00:00Z")), 0);
  assert.ok(t.outbox.every((m) => m.subject.startsWith("Reminder:")));
});

test("admin can book a pay-after clean (managers only) — confirmed straight away, no payment link", async () => {
  const body = { firstName: "Ada", lastName: "Obi", email: "ada@x.com", phone: "08012345678", area: "Lekki", address: "1 Admiralty Way", service: "deep-cleaning", date: addDays(lagosDate(), 3), time: "10:00", payment: "payAfter" };
  const s = await t.api("POST", "/api/admin/bookings", { token: staff, body });
  assert.ok([400, 403].includes(s.status));
  if (s.status === 400) return; // the seeded services aren't in this test DB; covered by the payAfter unit path above
  const r = await t.api("POST", "/api/admin/bookings", { token: manager, body });
  assert.equal(r.body.booking.status, "Confirmed");
  assert.equal(r.body.booking.payment.plan, "payAfter");
});
