const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const { seedServices } = require("../src/lib/seedData");
const { setSetting } = require("../src/lib/settings");
const { lagosDate, addDays } = require("../src/lib/time");
const Quote = require("../src/models/Quote");
const Booking = require("../src/models/Booking");

const paystack = fakePaystack();
let t, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  paystack.reset();
  await seedServices();
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

const quoteBody = (over = {}) => ({
  firstName: "Femi", lastName: "Ola", email: "femi@example.com", phone: "0805 555 6666", area: "Lekki Phase 2", address: "7 Chevron Drive",
  supplies: "cleaniq", items: [{ serviceSlug: "deep-cleaning", propertyType: "Duplex", bedrooms: 3, bathrooms: 3, extras: [{ slug: "extra-inside-fridge", qty: 1 }] }, { serviceSlug: "oven-cleaning", qty: 1, option: "Double oven" }],
  ...over,
});
const tokenFromEmail = () => t.outbox.find((m) => m.type === "quote").html.match(/\/quote\/(Q-NG-\d{6})\?t=([a-f0-9]{32})/);

test("quote builder: priced from the price list, emailed with an Accept link, 30 days valid", async () => {
  const r = await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody() });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const q = r.body.quote;
  // 3-bed duplex deep clean 67500 + fridge 7500 = 75000; double oven 22000; supplies 5000 (one visit)
  assert.equal(q.subtotal, 102000);
  assert.equal(q.grandTotal, 102000);
  assert.equal(q.items[0].size, "3-bed Duplex");
  assert.equal(q.status, "Sent");
  assert.equal(q.token, undefined, "secret token is never returned");
  const days = (new Date(q.validUntil) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days <= 30);
  const m = tokenFromEmail();
  assert.equal(m[1], q.quoteRef);
});

test("quote builder: staff can't override list prices or discount; managers can; VAT added", async () => {
  await setSetting("vat", { enabled: true, rate: 7.5 });
  const line = { serviceSlug: "regular-cleaning", propertyType: "Flat", bedrooms: 2, bathrooms: 2, qty: 4 };
  const body = { items: [{ ...line, unitPrice: 1 }], supplies: "customer", discount: 1000 };
  let r = await t.api("POST", "/api/admin/quotes/price", { token: staff, body });
  assert.equal(r.body.subtotal, 80000, "4 cleans of a 2-bed flat at the list price");
  assert.equal(r.body.discount, 0);
  r = await t.api("POST", "/api/admin/quotes/price", { token: manager, body: { ...body, items: [{ ...line, unitPrice: 18000 }] } });
  assert.equal(r.body.subtotal, 72000);
  assert.equal(r.body.discount, 1000);
  assert.equal(r.body.vat.amount, 5325);
  assert.equal(r.body.grandTotal, 76325);
});

test("quote builder: post-construction and custom lines are priced by whoever quotes", async () => {
  const items = [{ serviceSlug: "post-construction-cleaning", unitPrice: 250000 }, { label: "Remove builders' rubble <b>bags</b>", unitPrice: 15000, qty: 2 }];
  let r = await t.api("POST", "/api/admin/quotes/price", { token: staff, body: { items, supplies: "customer" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.grandTotal, 280000);
  assert.equal(r.body.items[1].service, "Remove builders' rubble bags");
  r = await t.api("POST", "/api/admin/quotes/price", { token: staff, body: { items: [{ serviceSlug: "post-construction-cleaning" }] } });
  assert.equal(r.status, 400, "needs a price");
  r = await t.api("POST", "/api/admin/quotes/price", { token: staff, body: { items: [{ serviceSlug: "deep-cleaning", propertyType: "Office", bedrooms: 0 }] } });
  assert.equal(r.status, 400, "not in the table and no price given");
  r = await t.api("POST", "/api/admin/quotes/price", { token: staff, body: { items: [{ serviceSlug: "deep-cleaning", propertyType: "Office", bedrooms: 0, unitPrice: 90000 }] } });
  assert.equal(r.body.items[0].kind, "quote");
});

test("quote builder: clear errors for bad items", async () => {
  const r = await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody({ email: "x", area: "Abuja", items: [{ serviceSlug: "oven-cleaning", qty: 1, option: "Huge oven" }, { serviceSlug: "nope" }] }) });
  assert.equal(r.status, 400);
  assert.ok(r.body.details.email && r.body.details.area && r.body.details["items.0"] && r.body.details["items.1"]);
});

test("public quote page needs the secret token and hides contact details", async () => {
  await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody() });
  const [, ref, tok] = tokenFromEmail();
  assert.equal((await t.api("GET", `/api/quotes/${ref}`)).status, 404);
  assert.equal((await t.api("GET", `/api/quotes/${ref}?t=${"0".repeat(32)}`)).status, 404);
  const r = await t.api("GET", `/api/quotes/${ref}?t=${tok}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.quote.firstName, "Femi");
  assert.ok(!JSON.stringify(r.body).includes("femi@example.com") && !JSON.stringify(r.body).includes("5556666"));
});

test("accept: picks date/time → Pending booking for the quote total + Paystack link; only once", async () => {
  await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody() });
  const [, ref, tok] = tokenFromEmail();
  let r = await t.api("POST", `/api/quotes/${ref}/accept`, { body: { t: tok, date: lagosDate(), time: "09:00" } });
  assert.equal(r.status, 400, "tomorrow onwards");
  r = await t.api("POST", `/api/quotes/${ref}/accept`, { body: { t: tok, date: addDays(lagosDate(), 3), time: "11:00" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.authorizationUrl, /checkout\.paystack\.test/);
  const b = await Booking.findOne({ bookingId: r.body.bookingId }).lean();
  assert.equal(b.payment.amount, 102000);
  assert.equal(b.details.size, "3-bed Duplex");
  assert.equal(b.status, "Pending");
  assert.equal(b.source, "quote");
  assert.equal(b.quoteRef, ref);
  assert.equal(paystack.calls.find((c) => c.name === "initialize").args.amountKobo, 10200000);
  const q = await Quote.findOne({ quoteRef: ref }).lean();
  assert.equal(q.status, "Accepted");
  assert.equal(q.followUpsStopped, true);
  assert.equal(q.bookingId, b.bookingId);
  r = await t.api("POST", `/api/quotes/${ref}/accept`, { body: { t: tok, date: addDays(lagosDate(), 3), time: "11:00" } });
  assert.equal(r.status, 400);
  assert.equal(await Booking.countDocuments(), 1);
});

test("accept: if Paystack fails the quote stays open", async () => {
  await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody() });
  const [, ref, tok] = tokenFromEmail();
  paystack.failNext = "initialize";
  const r = await t.api("POST", `/api/quotes/${ref}/accept`, { body: { t: tok, date: addDays(lagosDate(), 3), time: "11:00" } });
  assert.equal(r.status, 502);
  assert.equal((await Quote.findOne({ quoteRef: ref })).status, "Sent");
});

test("expiry, resend (renews 30 days), decline, history counts", async () => {
  const q = (await t.api("POST", "/api/admin/quotes", { token: staff, body: quoteBody() })).body.quote;
  await Quote.updateOne({ quoteRef: q.quoteRef }, { validUntil: new Date(Date.now() - 1000) });
  let r = await t.api("GET", "/api/admin/quotes", { token: staff });
  assert.equal(r.body.items[0].status, "Expired");
  assert.equal(r.body.counts.Expired.count, 1);
  const [, ref, tok] = tokenFromEmail();
  assert.equal((await t.api("POST", `/api/quotes/${ref}/accept`, { body: { t: tok, date: addDays(lagosDate(), 3), time: "11:00" } })).status, 400, "expired can't be accepted");
  r = await t.api("POST", `/api/admin/quotes/${q.quoteRef}/resend`, { token: staff });
  assert.equal(r.body.quote.status, "Sent");
  assert.equal(r.body.quote.sentCount, 2);
  r = await t.api("POST", `/api/admin/quotes/${q.quoteRef}/decline`, { token: staff });
  assert.equal(r.body.quote.status, "Declined");
  assert.equal((await t.api("POST", `/api/admin/quotes/${q.quoteRef}/resend`, { token: staff })).status, 400);
});
