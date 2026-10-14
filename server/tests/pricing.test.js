const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { priceBooking, sizePriceFor, extraBathrooms } = require("../src/lib/pricing");
const { STARTER_SERVICES, seedServices } = require("../src/lib/seedData");
const { startTestServer } = require("./helpers");
const { setSetting } = require("../src/lib/settings");

const services = STARTER_SERVICES.map((s) => ({ active: true, ...s }));
const settings = { suppliesFee: 5000, vat: { enabled: false, rate: 7.5, label: "VAT" } };
const deep = services.find((s) => s.slug === "deep-cleaning");
const err = (input) => {
  try {
    priceBooking(services, settings, input);
  } catch (e) {
    return e;
  }
  assert.fail("expected an error");
};

test("starter table: per clean by property type × bedrooms (no hourly prices anywhere)", () => {
  assert.equal(sizePriceFor(deep, "Flat", 2).price, 40000);
  assert.equal(sizePriceFor(deep, "Duplex", 3).price, 67500);
  assert.equal(sizePriceFor(deep, "Flat", 9).bedrooms, 6, "6+ row");
  assert.equal(sizePriceFor(deep, "Duplex", 1), null, "no 1-bed duplex → quote");
  assert.equal(sizePriceFor(deep, "Office", 2), null, "offices are quoted");
  const json = JSON.stringify(STARTER_SERVICES);
  for (const word of ["hourly", "minHours", "weeklyRate", "workerHourlyRate"]) assert.equal(json.includes(word), false, word);
});

test("extra bathrooms: charged beyond one per bedroom (self-contain includes one)", () => {
  assert.equal(extraBathrooms(2, 2), 0);
  assert.equal(extraBathrooms(2, 4), 2);
  assert.equal(extraBathrooms(0, 1), 0);
  assert.equal(extraBathrooms(0, 2), 1);
});

test("price: table price + extra bathrooms + add-ons + supplies; estimated time is info only", () => {
  const p = priceBooking(services, settings, {
    service: "deep-cleaning", propertyType: "Duplex", bedrooms: 3, bathrooms: 4, supplies: "cleaniq",
    extras: [{ slug: "extra-inside-oven", qty: 1 }, { slug: "extra-laundry", qty: 2 }],
  });
  // 67500 + 1 extra bathroom 6000 + oven 10000 + laundry 2×5000 + supplies 5000
  assert.equal(p.total, 98500);
  assert.equal(p.size, "3-bed Duplex");
  assert.equal(p.estHours, 8);
  assert.equal(p.lines[0].label, "Deep Cleaning — 3-bed Duplex");
  assert.ok(!p.lines.some((l) => /hour/i.test(l.label)), "no hours in the price lines");
});

test("price: VAT 7.5% on top when switched on", () => {
  const p = priceBooking(services, { ...settings, vat: { enabled: true, rate: 7.5, label: "VAT" } }, { service: "regular-cleaning", propertyType: "Flat", bedrooms: 2, bathrooms: 2, supplies: "customer" });
  assert.equal(p.subtotal, 20000);
  assert.equal(p.vat.amount, 1500);
  assert.equal(p.total, 21500);
});

test("price: repeated add-ons merged; zero ignored", () => {
  const p = priceBooking(services, settings, {
    service: "regular-cleaning", propertyType: "Flat", bedrooms: 1, bathrooms: 1, supplies: "customer",
    extras: [{ slug: "extra-inside-fridge", qty: 1 }, { slug: "extra-inside-fridge", qty: 2 }, { slug: "extra-ironing", qty: 0 }],
  });
  assert.equal(p.extras.length, 1);
  assert.equal(p.extras[0].qty, 3);
  assert.equal(p.total, 15000 + 22500);
});

test("price: needs a quote for properties not in the table and for quote-priced services", () => {
  let e = err({ service: "deep-cleaning", propertyType: "Office", bedrooms: 0, bathrooms: 1, supplies: "customer" });
  assert.equal(e.details.needsQuote, true);
  e = err({ service: "deep-cleaning", propertyType: "Mansion", bedrooms: 2, bathrooms: 2, supplies: "customer" });
  assert.equal(e.details.needsQuote, true);
  assert.match(e.details.propertyType, /2-bed mansion/);
  e = err({ service: "post-construction-cleaning", propertyType: "Flat", bedrooms: 2, supplies: "customer" });
  assert.match(e.details.service, /quote/);
  e = err({ service: "carpet-cleaning", propertyType: "Flat", bedrooms: 2, supplies: "customer" });
  assert.ok(e.details.service);
});

test("price: clear messages for missing choices", () => {
  const e = err({ extras: [{ slug: "made-up" }] });
  assert.equal(e.status, 400);
  for (const f of ["service", "propertyType", "bedrooms", "supplies", "extras"]) assert.ok(e.details[f], f);
  assert.ok(err({ service: "regular-cleaning", propertyType: "Flat", bedrooms: 1.5, bathrooms: 1, supplies: "customer" }).details.bedrooms);
});

// ── API ──────────────────────────────────────────────────────────────────────────────────
let t;
before(async () => (t = await startTestServer()));
after(async () => t.stop());
beforeEach(async () => t.reset());

test("GET /api/services: price table, 'from' price, no internal fields", async () => {
  await seedServices();
  await setSetting("vat", { enabled: true, rate: 7.5, label: "VAT" });
  const r = await t.api("GET", "/api/services");
  assert.equal(r.status, 200);
  const d = r.body.base.find((s) => s.slug === "deep-cleaning");
  assert.equal(d.pricing, "size");
  assert.equal(d.fromPrice, 20000);
  assert.ok(d.sizePrices.some((c) => c.propertyType === "Duplex" && c.bedrooms === 3 && c.price === 67500));
  assert.equal(r.body.base.find((s) => s.slug === "post-construction-cleaning").pricing, "quote");
  assert.equal(r.body.vat.enabled, true);
  assert.equal(JSON.stringify(r.body).includes("_id"), false);
});

test("seed adds the starter list only once", async () => {
  assert.ok((await seedServices()) > 0);
  assert.equal(await seedServices(), 0);
});
