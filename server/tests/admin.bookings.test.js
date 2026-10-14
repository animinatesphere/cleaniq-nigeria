const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const { seedServices } = require("../src/lib/seedData");
const { lagosDate, addDays } = require("../src/lib/time");
const Booking = require("../src/models/Booking");
const Worker = require("../src/models/Worker");
const Payment = require("../src/models/Payment");
const TrashItem = require("../src/models/TrashItem");
const AuditLog = require("../src/models/AuditLog");

const paystack = fakePaystack();
let t, owner, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  paystack.reset();
  await seedServices();
  owner = await t.adminToken("owner");
  staff = await t.adminToken("staff");
});

const form = (over = {}) => ({
  area: "Ikoyi", address: "4 Bourdillon Road", service: "regular-cleaning", propertyType: "Flat", supplies: "customer",
  bedrooms: 2, bathrooms: 1, kitchens: 1, livingRooms: 1, date: addDays(lagosDate(), 2), time: "09:00",
  firstName: "Tunde", lastName: "Bello", email: "tunde@example.com", phone: "08091234567", ...over,
});
async function paidBooking(over = {}) {
  const r = await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form(over), payment: "offline", offlineMethod: "Bank transfer" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.booking;
}
async function paystackPaidBooking() {
  const r = await t.api("POST", "/api/bookings", { body: { ...form(), propertyType: "Flat", pets: false, parking: "Street parking nearby", access: "Someone will be home" } });
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { status: "success", reference: r.body.reference, amount: Math.round(r.body.total * 100), currency: "NGN", channel: "card" } }));
  const sig = crypto.createHmac("sha512", t.config.paystackSecretKey).update(raw).digest("hex");
  await t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
  return Booking.findOne({ bookingId: r.body.bookingId }).lean();
}
async function worker(email = "chidi@cleaniq.test") {
  return Worker.create({ firstName: "Chidi", lastName: "Okafor", email, passwordHash: await bcrypt.hash("x-password-123", 4), pay: { type: "perJob", perJobRate: 6000 } });
}

test("new booking by staff: Paystack link emailed; price from the price list", async () => {
  const r = await t.api("POST", "/api/admin/bookings", { token: staff, body: { ...form(), payment: "paystack", total: 1 } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.booking.payment.amount, 20000, "2-bed flat regular clean");
  assert.equal(r.body.booking.status, "Pending");
  assert.match(r.body.paymentLink, /checkout\.paystack\.test/);
  assert.equal(r.body.booking.source, "admin");
  assert.ok(t.outbox.some((m) => m.type === "booking-received"));
  assert.ok(await AuditLog.exists({ action: "booking.create", target: r.body.booking.bookingId }));
});

test("new booking: today allowed for staff, property/access details optional", async () => {
  const r = await t.api("POST", "/api/admin/bookings", { token: staff, body: { ...form({ date: lagosDate() }), payment: "later" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.paymentLink, null);
  assert.equal(t.outbox.length, 0, "no email when paying later");
});

test("new booking: paid offline confirms straight away — owners/managers only", async () => {
  const denied = await t.api("POST", "/api/admin/bookings", { token: staff, body: { ...form(), payment: "offline" } });
  assert.equal(denied.status, 403);
  const b = await paidBooking();
  assert.equal(b.status, "Confirmed");
  assert.equal(b.payment.status, "Paid");
  assert.equal(b.payment.offline.method, "Bank transfer");
  assert.ok(await Payment.exists({ bookingId: b.bookingId, status: "success" }));
  assert.ok(t.outbox.some((m) => m.type === "booking-confirmed"));
});

test("list: search, filter by status and date", async () => {
  await paidBooking();
  await paidBooking({ email: "ngozi@example.com", firstName: "Ngozi", date: addDays(lagosDate(), 5) });
  await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form({ email: "x@example.com" }), payment: "later" } });
  let r = await t.api("GET", "/api/admin/bookings?q=ngozi", { token: staff });
  assert.equal(r.body.total, 1);
  r = await t.api("GET", "/api/admin/bookings?status=Pending", { token: staff });
  assert.equal(r.body.total, 1);
  r = await t.api("GET", `/api/admin/bookings?from=${addDays(lagosDate(), 4)}`, { token: staff });
  assert.equal(r.body.total, 1);
  r = await t.api("GET", "/api/admin/bookings?q=.*", { token: staff });
  assert.equal(r.body.total, 0, "search text is not a regular expression");
});

test("status: assign, start, complete → worker pay + one 'done' email with receipt", async () => {
  const b = await paidBooking();
  const w = await worker();
  let r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: staff, body: { status: "Assigned" } });
  assert.equal(r.status, 400, "needs a cleaner first");
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/assign`, { token: staff, body: { workerId: w._id } });
  assert.equal(r.body.booking.status, "Assigned");
  assert.equal(r.body.booking.assignedWorkerName, "Chidi Okafor");
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: staff, body: { status: "In Progress" } });
  assert.equal(r.status, 200);
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: staff, body: { status: "Completed" } });
  assert.equal(r.status, 200);
  const done = await Booking.findOne({ bookingId: b.bookingId }).lean();
  assert.equal(done.workerPay.status, "unpaid");
  assert.equal(done.workerPay.amount, 6000, "cleaner's per-job rate");
  assert.equal(t.outbox.filter((m) => m.type === "booking-completed").length, 1);
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/status`, { token: staff, body: { status: "Confirmed" } });
  assert.equal(r.status, 400, "completed bookings can't go back");
});

test("status: staff can't confirm an unpaid booking; managers can", async () => {
  const r0 = await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form(), payment: "later" } });
  const id = r0.body.booking.bookingId;
  assert.equal((await t.api("PATCH", `/api/admin/bookings/${id}/status`, { token: staff, body: { status: "Confirmed" } })).status, 403);
  assert.equal((await t.api("PATCH", `/api/admin/bookings/${id}/status`, { token: owner, body: { status: "Confirmed" } })).status, 200);
});

test("assign: only active cleaners; unassign goes back to Confirmed", async () => {
  const b = await paidBooking();
  const w = await worker();
  await Worker.updateOne({ _id: w._id }, { status: "suspended" });
  let r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/assign`, { token: staff, body: { workerId: w._id } });
  assert.equal(r.status, 400);
  await Worker.updateOne({ _id: w._id }, { status: "active" });
  await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/assign`, { token: staff, body: { workerId: w._id } });
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/assign`, { token: staff, body: { workerId: null } });
  assert.equal(r.body.booking.status, "Confirmed");
  assert.equal(r.body.booking.assignedWorker, null);
});

test("jobs board, visibility and calendar", async () => {
  const b = await paidBooking();
  const w = await worker();
  let r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/visibility`, { token: staff, body: { hidden: false, visibleTo: [String(w._id)] } });
  assert.equal(r.status, 200);
  r = await t.api("GET", "/api/admin/bookings/jobs", { token: staff });
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].job.visibleTo[0].firstName, "Chidi");
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/visibility`, { token: staff, body: { visibleTo: ["64b7f0c2a1b2c3d4e5f60718"] } });
  assert.equal(r.status, 400, "unknown cleaner refused");
  r = await t.api("GET", `/api/admin/bookings/calendar?from=${lagosDate()}&to=${addDays(lagosDate(), 7)}`, { token: staff });
  assert.equal(r.body.items.length, 1);
  r = await t.api("GET", `/api/admin/bookings/calendar?from=2026-01-01&to=2026-12-31`, { token: staff });
  assert.equal(r.status, 400, "range too long");
});

test("reschedule, notes (HTML stripped), detail with history", async () => {
  const b = await paidBooking();
  let r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/schedule`, { token: staff, body: { date: addDays(lagosDate(), 9), time: "14:30" } });
  assert.equal(r.body.booking.schedule.time, "14:30");
  r = await t.api("PATCH", `/api/admin/bookings/${b.bookingId}/schedule`, { token: staff, body: { date: "2020-01-01", time: "14:30" } });
  assert.equal(r.status, 400);
  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/notes`, { token: staff, body: { text: "Called <b>customer</b>" } });
  assert.equal(r.body.booking.notes.at(-1).text, "Called customer");
  assert.equal(r.body.booking.notes.at(-1).by, "staff");
  r = await t.api("GET", `/api/admin/bookings/${b.bookingId}`, { token: staff });
  assert.ok(r.body.history.some((h) => h.action === "booking.reschedule"));
  assert.ok(r.body.emails.length >= 1);
  assert.equal(r.body.payments.length, 1);
});

test("resend emails: right email for the payment state", async () => {
  const paid = await paidBooking();
  assert.equal((await t.api("POST", `/api/admin/bookings/${paid.bookingId}/resend`, { token: staff, body: { type: "payment-link" } })).status, 400);
  assert.equal((await t.api("POST", `/api/admin/bookings/${paid.bookingId}/resend`, { token: staff, body: { type: "confirmation" } })).status, 200);
  assert.equal((await t.api("POST", `/api/admin/bookings/${paid.bookingId}/resend`, { token: staff, body: { type: "invoice" } })).status, 200);
  const unpaid = (await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form({ email: "u@example.com" }), payment: "paystack" } })).body.booking;
  assert.equal((await t.api("POST", `/api/admin/bookings/${unpaid.bookingId}/resend`, { token: staff, body: { type: "confirmation" } })).status, 400);
  assert.equal((await t.api("POST", `/api/admin/bookings/${unpaid.bookingId}/resend`, { token: staff, body: { type: "payment-link" } })).status, 200);
});

test("take payment: create link later; mark paid offline once", async () => {
  const b = (await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form(), payment: "later" } })).body.booking;
  let r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/payment-link`, { token: staff, body: {} });
  assert.match(r.body.paymentLink, /checkout\.paystack\.test/);
  const again = await t.api("POST", `/api/admin/bookings/${b.bookingId}/payment-link`, { token: staff, body: { email: false } });
  assert.equal(again.body.paymentLink, r.body.paymentLink, "same link, no second Paystack transaction");
  assert.equal(paystack.calls.filter((c) => c.name === "initialize").length, 1);

  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/mark-paid`, { token: owner, body: { method: "Cash", note: "Paid at the door" } });
  assert.equal(r.body.booking.status, "Confirmed");
  assert.equal(r.body.booking.payment.status, "Paid");
  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/mark-paid`, { token: owner, body: { method: "Cash" } });
  assert.equal(r.status, 400, "can't be marked paid twice");
});

test("cancel with refund via Paystack; refund webhook completes it; can't refund twice", async () => {
  const b = await paystackPaidBooking();
  let r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/cancel`, { token: owner, body: { reason: "Customer travelling", refund: true } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.booking.status, "Cancelled");
  assert.equal(r.body.booking.payment.status, "Refund pending");
  assert.equal(r.body.booking.payment.refund.amount, b.payment.amount);
  assert.equal(paystack.calls.filter((c) => c.name === "refund").length, 1);
  assert.ok(t.outbox.some((m) => m.type === "booking-cancelled" && m.html.includes("refund")));

  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/refund`, { token: owner, body: {} });
  assert.equal(r.status, 400);

  const raw = Buffer.from(JSON.stringify({ event: "refund.processed", data: { transaction_reference: b.payment.reference } }));
  const sig = crypto.createHmac("sha512", t.config.paystackSecretKey).update(raw).digest("hex");
  await t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
  const after = await Booking.findOne({ bookingId: b.bookingId }).lean();
  assert.equal(after.payment.status, "Refunded");
  assert.equal((await Payment.findOne({ reference: b.payment.reference })).status, "refunded");
});

test("partial refund amount is checked; Paystack failure leaves it paid", async () => {
  const b = await paystackPaidBooking();
  let r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/refund`, { token: owner, body: { amount: b.payment.amount + 1 } });
  assert.equal(r.status, 400);
  paystack.failNext = "refund";
  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/refund`, { token: owner, body: { amount: 5000 } });
  assert.equal(r.status, 502);
  assert.equal((await Booking.findOne({ bookingId: b.bookingId })).payment.status, "Paid");
  r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/refund`, { token: owner, body: { amount: 5000 } });
  assert.equal(r.body.booking.payment.refund.amount, 5000);
  assert.equal(paystack.calls.filter((c) => c.name === "refund").at(-1).args.amountKobo, 500000);
});

test("offline-paid bookings can't be refunded through Paystack", async () => {
  const b = await paidBooking();
  const r = await t.api("POST", `/api/admin/bookings/${b.bookingId}/refund`, { token: owner, body: {} });
  assert.equal(r.status, 400);
});

test("delete moves to the Bin and can be restored", async () => {
  const b = await paidBooking();
  assert.equal((await t.api("DELETE", `/api/admin/bookings/${b.bookingId}`, { token: owner })).status, 200);
  assert.equal(await Booking.countDocuments({ bookingId: b.bookingId }), 0);
  const item = await TrashItem.findOne({ modelName: "Booking" });
  assert.match(item.label, /Tunde Bello/);
  const bin = await t.api("GET", "/api/admin/bin", { token: owner });
  assert.equal(bin.body.items.length, 1);
  assert.equal((await t.api("POST", `/api/admin/bin/${item._id}/restore`, { token: owner })).status, 200);
  assert.equal(await Booking.countDocuments({ bookingId: b.bookingId }), 1);
});

test("dashboard: today's jobs and revenue (Lagos day)", async () => {
  await paidBooking({ date: lagosDate(), time: "10:00" });
  await paidBooking({ email: "z@example.com", date: addDays(lagosDate(), 3) });
  await t.api("POST", "/api/admin/bookings", { token: owner, body: { ...form({ email: "p@example.com" }), payment: "paystack" } });
  const r = await t.api("GET", "/api/admin/dashboard", { token: staff });
  assert.equal(r.status, 200);
  assert.equal(r.body.todaysJobs.length, 1);
  assert.equal(r.body.revenueToday.total, 40000);
  assert.equal(r.body.revenueToday.count, 2);
  assert.equal(r.body.awaitingPayment, 1);
  assert.equal(r.body.unassigned, 2);
  assert.equal(r.body.upcoming.length, 1);
});
