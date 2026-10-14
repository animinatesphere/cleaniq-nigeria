const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startTestServer } = require("./helpers");
const { seedServices } = require("../src/lib/seedData");
const { setSetting } = require("../src/lib/settings");
const { lagosDate, addDays } = require("../src/lib/time");
const { sendDueReminders } = require("../src/jobs/reminders");
const Booking = require("../src/models/Booking");
const Payment = require("../src/models/Payment");
const Customer = require("../src/models/Customer");
const Lead = require("../src/models/Lead");

// Stand-in for Paystack: records calls, verify() answers what each test sets.
const paystack = {
  initialized: [],
  verifyResult: null,
  async initialize(args) {
    this.initialized.push(args);
    return { authorization_url: `https://checkout.paystack.test/${args.reference}`, access_code: "ac_test", reference: args.reference };
  },
  async verify() {
    if (!this.verifyResult) throw new Error("not set");
    return this.verifyResult;
  },
};

let t;
before(async () => (t = await startTestServer({ deps: { paystack }, env: { TEAM_EMAIL: "team@cleaniq.test" } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  await seedServices();
  paystack.initialized.length = 0;
  paystack.verifyResult = null;
});

const tomorrow = () => addDays(lagosDate(), 1);
const form = (over = {}) => ({
  area: "Lekki Phase 1", address: "12 Admiralty Way", landmark: "Opposite the filling station",
  service: "deep-cleaning",
  propertyType: "Flat", bedrooms: 2, bathrooms: 2, kitchens: 1, livingRooms: 1, stairs: 0, pets: false,
  extras: [{ slug: "extra-inside-oven", qty: 1 }], supplies: "cleaniq",
  parking: "Parking inside the compound", access: "Someone will be home", instructions: "Gate code <b>1234</b>",
  date: tomorrow(), time: "09:30",
  firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "0803 123 4567",
  ...over,
});

function webhook(payload, secret = t.config.paystackSecretKey) {
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  return t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
}
const chargeSuccess = (b, over = {}) => ({
  event: "charge.success",
  data: { status: "success", reference: b.reference, amount: Math.round(b.total * 100), currency: "NGN", channel: "card", paid_at: new Date().toISOString(), ...over },
});

test("options: Lagos areas, time slots 8am–6pm, dates from tomorrow (Lagos)", async () => {
  const r = await t.api("GET", "/api/bookings/options");
  assert.equal(r.status, 200);
  assert.ok(r.body.areas.includes("Lekki Phase 1"));
  assert.equal(r.body.timeSlots[0], "08:00");
  assert.equal(r.body.timeSlots.at(-1), "18:00");
  assert.equal(r.body.timeSlots.length, 21);
  assert.equal(r.body.minDate, tomorrow());
});

test("quote-price returns the server's total", async () => {
  const r = await t.api("POST", "/api/bookings/quote-price", { body: { service: "deep-cleaning", propertyType: "Flat", bedrooms: 2, bathrooms: 2, supplies: "cleaniq", extras: [{ slug: "extra-inside-oven", qty: 1 }] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 40000 + 10000 + 5000);
  assert.equal(r.body.size, "2-bed Flat");
});

test("quote-price adds VAT when switched on", async () => {
  await setSetting("vat", { enabled: true, rate: 7.5 });
  const r = await t.api("POST", "/api/bookings/quote-price", { body: { service: "regular-cleaning", propertyType: "Flat", bedrooms: 1, bathrooms: 1, supplies: "customer" } });
  assert.equal(r.body.subtotal, 15000);
  assert.equal(r.body.vat.amount, 1125);
  assert.equal(r.body.total, 16125);
});

test("quote-price: a property that isn't in the price table asks for a quote", async () => {
  const r = await t.api("POST", "/api/bookings/quote-price", { body: { service: "deep-cleaning", propertyType: "Office", bedrooms: 0, bathrooms: 2, supplies: "customer" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.details.needsQuote, true);
});

test("create booking: Pending, server price in kobo, Paystack link, customer + lead + email", async () => {
  const r = await t.api("POST", "/api/bookings", { body: { ...form(), total: 1, amount: 1, status: "Confirmed", payment: { status: "Paid" } } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.bookingId, /^NG-\d{6}$/);
  assert.equal(r.body.total, 55000, "browser-sent amount is ignored");
  assert.ok(r.body.authorizationUrl.startsWith("https://checkout.paystack.test/"));

  const init = paystack.initialized[0];
  assert.equal(init.amountKobo, 5500000);
  assert.equal(init.email, "ada@example.com");
  assert.match(init.callbackUrl, /\/payment\/success\?booking=NG-\d{6}&reference=/);

  const b = await Booking.findOne({ bookingId: r.body.bookingId }).lean();
  assert.equal(b.status, "Pending", "browser can't confirm a booking");
  assert.equal(b.payment.status, "Pending");
  assert.equal(b.payment.amount, 55000);
  assert.equal(b.details.size, "2-bed Flat");
  assert.equal(b.details.estHours, 6);
  assert.equal(b.customer.phone, "+2348031234567");
  assert.equal(b.details.instructions, "Gate code 1234", "HTML stripped");
  assert.equal(b.details.rooms.bedrooms, 2);
  assert.ok(await Customer.exists({ email: "ada@example.com" }));
  assert.ok(await Lead.exists({ ref: b.bookingId }));
  const mail = t.outbox.find((m) => m.type === "booking-received");
  assert.ok(mail && mail.to === "ada@example.com");
  assert.ok(mail.html.includes(r.body.authorizationUrl));
  assert.ok(!mail.html.includes("<b>1234"), "customer text is escaped");
});

test("create booking: every problem reported by field", async () => {
  const r = await t.api("POST", "/api/bookings", {
    body: form({ area: "London", address: "x", service: "made-up", supplies: "", bedrooms: 0, bathrooms: 0, kitchens: 0, livingRooms: 0, pets: undefined, date: lagosDate(), time: "07:00", email: "nope", phone: "123", firstName: "" }),
  });
  assert.equal(r.status, 400);
  for (const f of ["area", "address", "service", "supplies", "rooms", "pets", "date", "time", "email", "phone", "firstName"]) {
    assert.ok(r.body.details[f], `expected an error for ${f}`);
  }
  assert.equal(paystack.initialized.length, 0);
  assert.equal(await Booking.countDocuments(), 0);
});

test("create booking: dates must be tomorrow to 90 days ahead (Lagos)", async () => {
  const far = await t.api("POST", "/api/bookings", { body: form({ date: addDays(lagosDate(), 91) }) });
  assert.equal(far.status, 400);
  assert.ok(far.body.details.date);
  const ok = await t.api("POST", "/api/bookings", { body: form({ date: addDays(lagosDate(), 90), time: "18:00" }) });
  assert.equal(ok.status, 201);
});

test("webhook: bad signature refused and booking untouched", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  const bad = await webhook(chargeSuccess(created), "sk_wrong");
  assert.equal(bad.status, 401);
  const none = await t.api("POST", "/api/payments/paystack/webhook", { raw: Buffer.from("{}"), headers: { "Content-Type": "application/json" } });
  assert.equal(none.status, 401);
  assert.equal((await Booking.findOne({ bookingId: created.bookingId })).status, "Pending");
});

test("webhook: confirms once even when Paystack sends the event twice", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  const [a, b] = await Promise.all([webhook(chargeSuccess(created)), webhook(chargeSuccess(created))]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  await webhook(chargeSuccess(created));

  const booking = await Booking.findOne({ bookingId: created.bookingId }).lean();
  assert.equal(booking.status, "Confirmed");
  assert.equal(booking.payment.status, "Paid");
  assert.equal(booking.payment.channel, "card");
  assert.ok(booking.payment.paidAt);
  assert.equal(await Payment.countDocuments({ reference: created.reference }), 1);
  assert.equal(t.outbox.filter((m) => m.type === "booking-confirmed").length, 1, "one confirmation email");
  assert.equal(t.outbox.filter((m) => m.to === "team@cleaniq.test").length, 1, "one team alert");
});

test("webhook: wrong amount or currency does not confirm", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  await webhook(chargeSuccess(created, { amount: 100 }));
  let b = await Booking.findOne({ bookingId: created.bookingId }).lean();
  assert.equal(b.status, "Pending");
  assert.match(b.payment.problem, /NGN/);
  await webhook(chargeSuccess(created, { currency: "USD" }));
  b = await Booking.findOne({ bookingId: created.bookingId }).lean();
  assert.equal(b.payment.status, "Pending");
});

test("webhook: other events and unknown references are accepted but ignored", async () => {
  const r1 = await webhook({ event: "transfer.success", data: {} });
  assert.equal(r1.status, 200);
  const r2 = await webhook({ event: "charge.success", data: { status: "success", reference: "nope", amount: 1, currency: "NGN" } });
  assert.equal(r2.status, 200);
});

test("webhook: payment for a cancelled booking is recorded but it stays cancelled", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  await Booking.updateOne({ bookingId: created.bookingId }, { status: "Cancelled" });
  await webhook(chargeSuccess(created));
  const b = await Booking.findOne({ bookingId: created.bookingId }).lean();
  assert.equal(b.status, "Cancelled");
  assert.equal(b.payment.status, "Paid");
  assert.equal(t.outbox.filter((m) => m.type === "booking-confirmed").length, 0);
});

test("status page: needs the reference, never returns personal details, verifies with Paystack", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  const noRef = await t.api("GET", `/api/bookings/${created.bookingId}/status`);
  assert.equal(noRef.status, 404);
  const wrongRef = await t.api("GET", `/api/bookings/${created.bookingId}/status?reference=guess`);
  assert.equal(wrongRef.status, 404);

  const pending = await t.api("GET", `/api/bookings/${created.bookingId}/status?reference=${created.reference}`);
  assert.equal(pending.body.paymentStatus, "Pending");
  const json = JSON.stringify(pending.body);
  assert.ok(!json.includes("ada@example.com") && !json.includes("2348031234567") && !json.includes("Admiralty"));

  // Webhook delayed: the status check asks Paystack (server-side) and confirms.
  paystack.verifyResult = chargeSuccess(created).data;
  const paid = await t.api("GET", `/api/bookings/${created.bookingId}/status?reference=${created.reference}`);
  assert.equal(paid.body.status, "Confirmed");
  assert.equal(paid.body.paymentStatus, "Paid");
  // The webhook arriving afterwards changes nothing.
  await webhook(chargeSuccess(created));
  assert.equal(t.outbox.filter((m) => m.type === "booking-confirmed").length, 1);
});

test("status page: a failed Paystack verify leaves the booking pending", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  paystack.verifyResult = { ...chargeSuccess(created).data, status: "abandoned" };
  const r = await t.api("GET", `/api/bookings/${created.bookingId}/status?reference=${created.reference}`);
  assert.equal(r.body.status, "Pending");
});

test("reminders: sent once, the day before, only for confirmed bookings (Lagos dates)", async () => {
  const created = (await t.api("POST", "/api/bookings", { body: form() })).body;
  const other = (await t.api("POST", "/api/bookings", { body: form({ email: "b@example.com" }) })).body;
  await webhook(chargeSuccess(created)); // confirmed; `other` stays Pending
  const ctx = t.app.locals.ctx;
  assert.equal(await sendDueReminders(ctx), 1);
  assert.equal(await sendDueReminders(ctx), 0, "never twice");
  const reminders = t.outbox.filter((m) => m.type === "booking-reminder");
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].to, "ada@example.com");
  assert.ok(other);
});

test("emails are logged for admin email history", async () => {
  const EmailLog = require("../src/models/EmailLog");
  await t.api("POST", "/api/bookings", { body: form() });
  assert.equal(await EmailLog.countDocuments({ type: "booking-received", status: "sent" }), 1);
});
