const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { priceBooking, offeredFrequencies } = require("../src/lib/pricing");
const { STARTER_SERVICES, seedServices } = require("../src/lib/seedData");
const { startTestServer } = require("./helpers");
const { setSetting } = require("../src/lib/settings");

const services = STARTER_SERVICES.map((s) => ({ active: true, minHours: 1, ...s }));
const settings = { suppliesFee: 5000, vat: { enabled: false, rate: 7.5, label: "VAT" } };

test("price: hourly rate × hours + extras + supplies", () => {
  const p = priceBooking(services, settings, {
    service: "deep-cleaning", frequency: "once", hours: 4, supplies: "cleaniq",
    extras: [{ slug: "extra-inside-oven", qty: 1 }, { slug: "extra-windows", qty: 3 }],
  });
  // 7000×4 = 28000; oven 10000; windows 2500×3 = 7500; supplies 5000
  assert.equal(p.subtotal, 50500);
  assert.equal(p.total, 50500);
  assert.equal(p.vat.amount, 0);
  assert.equal(p.lines.length, 4);
  assert.equal(p.currency, "NGN");
});

test("price: regular frequency uses its own hourly rate", () => {
  const p = priceBooking(services, settings, { service: "regular-cleaning", frequency: "weekly", hours: 3, supplies: "customer" });
  assert.equal(p.hourlyRate, 4500);
  assert.equal(p.total, 13500);
  assert.match(p.lines[0].label, /Weekly/);
});

test("price: VAT 7.5% added on top when switched on, rounded to kobo", () => {
  const p = priceBooking(services, { ...settings, vat: { enabled: true, rate: 7.5, label: "VAT" } }, {
    service: "regular-cleaning", frequency: "once", hours: 2.5, supplies: "customer",
  });
  assert.equal(p.subtotal, 12500);
  assert.equal(p.vat.amount, 937.5);
  assert.equal(p.total, 13437.5);
});

test("price: repeated extras are merged; zero quantity ignored", () => {
  const p = priceBooking(services, settings, {
    service: "regular-cleaning", hours: 2, supplies: "customer",
    extras: [{ slug: "extra-inside-fridge", qty: 1 }, { slug: "extra-inside-fridge", qty: 2 }, { slug: "extra-laundry", qty: 0 }],
  });
  assert.equal(p.extras.length, 1);
  assert.equal(p.extras[0].qty, 3);
  assert.equal(p.total, 10000 + 22500);
});

test("price: refuses bad choices with clear field messages", () => {
  const err = (input) => {
    try {
      priceBooking(services, settings, input);
    } catch (e) {
      return e;
    }
    assert.fail("expected an error");
  };
  let e = err({});
  assert.equal(e.status, 400);
  assert.ok(e.details.service && e.details.supplies);
  e = err({ service: "deep-cleaning", hours: 2, supplies: "customer" });
  assert.match(e.details.hours, /between 3 and 12/);
  e = err({ service: "deep-cleaning", hours: 3.25, supplies: "customer" });
  assert.ok(e.details.hours, "only whole or half hours");
  e = err({ service: "post-construction-cleaning", frequency: "weekly", hours: 4, supplies: "customer" });
  assert.ok(e.details.frequency, "weekly not priced for post-construction");
  e = err({ service: "regular-cleaning", hours: 2, supplies: "customer", extras: [{ slug: "made-up" }] });
  assert.ok(e.details.extras);
  e = err({ service: "regular-cleaning", hours: 2, supplies: "customer", extras: [{ slug: "extra-laundry", qty: 99 }] });
  assert.ok(e.details.extras);
  e = err({ service: "carpet-cleaning", hours: 2, supplies: "customer" });
  assert.ok(e.details.service, "flat services aren't booked by the hour");
});

test("frequencies: one-off always, regular only when priced", () => {
  const regular = services.find((s) => s.slug === "regular-cleaning");
  assert.deepEqual(offeredFrequencies(regular).map((f) => f.key), ["once", "weekly", "fortnightly"]);
  const post = services.find((s) => s.slug === "post-construction-cleaning");
  assert.deepEqual(offeredFrequencies(post).map((f) => f.key), ["once"]);
});

// ── API ──────────────────────────────────────────────────────────────────────────────────
let t;
before(async () => (t = await startTestServer()));
after(async () => t.stop());
beforeEach(async () => t.reset());

test("GET /api/services returns the public price list without cleaner pay", async () => {
  await seedServices();
  await setSetting("vat", { enabled: true, rate: 7.5, label: "VAT" });
  const r = await t.api("GET", "/api/services");
  assert.equal(r.status, 200);
  assert.equal(r.body.currency, "NGN");
  assert.ok(r.body.base.some((s) => s.slug === "deep-cleaning"));
  assert.ok(r.body.extras.some((s) => s.slug === "extra-inside-oven"));
  assert.equal(r.body.vat.enabled, true);
  assert.equal(r.body.suppliesFee, 5000);
  const json = JSON.stringify(r.body);
  assert.equal(json.includes("workerHourlyRate"), false);
  assert.equal(json.includes("workerPaymentRate"), false);
});

test("seed adds the starter list only once", async () => {
  assert.ok((await seedServices()) > 0);
  assert.equal(await seedServices(), 0);
});
