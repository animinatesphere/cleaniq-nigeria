// Server-side prices, per clean (Nigeria never charges by the hour). The browser only sends choices —
// service, property type, bedrooms, bathrooms, add-ons, supplies — and every amount comes from here.
const { round2 } = require("./money");
const { badRequest } = require("../middleware/errors");
const { SIZE_PROPERTY_TYPES, MAX_BEDROOM_ROW, bedroomLabel } = require("./lagos");

const SUPPLIES = { cleaniq: "Cleaniq brings supplies & equipment", customer: "Customer provides supplies" };
const MAX_EXTRA_QTY = 20;

// The price-table cell for a property, or null when it must be quoted.
function sizePriceFor(service, propertyType, bedrooms) {
  if (service?.pricing !== "size") return null;
  const row = Math.min(Math.max(0, Math.floor(Number(bedrooms) || 0)), MAX_BEDROOM_ROW);
  return (service.sizePrices || []).find((c) => c.propertyType === propertyType && c.bedrooms === row && c.price > 0) || null;
}

// Extra bathrooms are charged beyond one per bedroom (a self-contain includes one bathroom).
const extraBathrooms = (bedrooms, bathrooms) => Math.max(0, Math.floor(Number(bathrooms) || 0) - Math.max(1, Math.floor(Number(bedrooms) || 0)));

// What the public price list shows.
function publicService(s) {
  const out = {
    name: s.name, slug: s.slug, category: s.category, pricing: s.pricing || "fixed", rate: s.rate,
    unitLabel: s.unitLabel || "", description: s.description || "",
    options: (s.options || []).map((o) => ({ label: o.label, rate: o.rate })),
  };
  if (s.pricing === "size") {
    const cells = (s.sizePrices || []).filter((c) => c.price > 0);
    Object.assign(out, {
      sizePrices: cells.map((c) => ({ propertyType: c.propertyType, bedrooms: c.bedrooms, price: c.price, estHours: c.estHours })),
      fromPrice: cells.length ? Math.min(...cells.map((c) => c.price)) : null,
      extraBathroomPrice: s.extraBathroomPrice || 0,
    });
  }
  return out;
}

// Merges repeated add-ons and checks each one exists. Returns [{ service, qty }].
function resolveExtras(services, extrasInput, errors) {
  if (extrasInput === undefined || extrasInput === null) return [];
  if (!Array.isArray(extrasInput) || extrasInput.length > 20) {
    errors.extras = "Please check the add-ons you chose";
    return [];
  }
  const bySlug = new Map(services.filter((s) => s.category === "Extras" && s.active !== false).map((s) => [s.slug, s]));
  const qtyBySlug = new Map();
  for (const e of extrasInput) {
    const svc = bySlug.get(String(e?.slug || ""));
    const qty = Number(e?.qty ?? 1);
    if (!svc) {
      errors.extras = "One of the add-ons you chose is no longer available";
      continue;
    }
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_EXTRA_QTY) {
      errors.extras = `Add-on quantity must be between 1 and ${MAX_EXTRA_QTY}`;
      continue;
    }
    if (qty > 0) qtyBySlug.set(svc.slug, Math.min(MAX_EXTRA_QTY, (qtyBySlug.get(svc.slug) || 0) + qty));
  }
  return [...qtyBySlug].map(([slug, qty]) => ({ service: bySlug.get(slug), qty }));
}

function addVat(lines, vat) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const vatAmount = vat?.enabled ? round2((subtotal * vat.rate) / 100) : 0;
  return {
    lines,
    subtotal,
    vat: { enabled: Boolean(vat?.enabled), rate: vat?.rate ?? 0, label: vat?.label || "VAT", amount: vatAmount },
    total: round2(subtotal + vatAmount),
    currency: "NGN",
  };
}

// Price one clean: the price-table cell for the property + extra bathrooms + add-ons + supplies fee (+ VAT).
// Throws a 400 with per-field messages; details.needsQuote = true when this property must be quoted.
function priceBooking(services, settings, input = {}) {
  const errors = {};
  const service = services.find((s) => s.slug === input.service && s.category === "Base" && s.active !== false);
  if (!service) errors.service = "Please choose a service";
  else if (service.pricing !== "size") errors.service = "This service is priced after a quick look — please request a quote";

  const propertyType = String(input.propertyType || "");
  const bedrooms = Number(input.bedrooms ?? NaN);
  const bathrooms = Number(input.bathrooms ?? 0);
  if (!propertyType) errors.propertyType = "Please choose your property type";
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20) errors.bedrooms = "Please enter the number of bedrooms";
  if (!Number.isInteger(bathrooms) || bathrooms < 0 || bathrooms > 20) errors.bathrooms = "Please enter the number of bathrooms";

  let cell = null;
  if (service?.pricing === "size" && !errors.propertyType && !errors.bedrooms) {
    cell = sizePriceFor(service, propertyType, bedrooms);
    if (!cell) {
      errors.propertyType = SIZE_PROPERTY_TYPES.includes(propertyType)
        ? `We price a ${bedroomLabel(Math.min(bedrooms, MAX_BEDROOM_ROW))} ${propertyType.toLowerCase()} after a quick look — please request a quote`
        : "We price this property after a quick look — please request a quote";
      errors.needsQuote = true;
    }
  }

  const supplies = String(input.supplies || "");
  if (!SUPPLIES[supplies]) errors.supplies = "Please tell us who's providing the cleaning supplies";

  const extras = resolveExtras(services, input.extras, errors);
  if (Object.keys(errors).length) throw badRequest(errors.needsQuote ? "This one needs a quote" : "Please check your booking details", errors);

  const size = `${bedroomLabel(cell.bedrooms)} ${propertyType}`;
  const extraBaths = extraBathrooms(bedrooms, bathrooms);
  const lines = [{ key: "service", label: `${service.name} — ${size}`, qty: 1, unitPrice: cell.price, amount: round2(cell.price) }];
  if (extraBaths && service.extraBathroomPrice > 0) {
    lines.push({ key: "extra-bathrooms", label: "Extra bathrooms", qty: extraBaths, unitPrice: service.extraBathroomPrice, amount: round2(service.extraBathroomPrice * extraBaths) });
  }
  lines.push(...extras.map(({ service: x, qty }) => ({ key: `extra:${x.slug}`, label: x.name, qty, unitPrice: x.rate, amount: round2(x.rate * qty) })));
  if (supplies === "cleaniq" && settings.suppliesFee > 0) {
    lines.push({ key: "supplies", label: "Cleaning supplies & equipment", qty: 1, unitPrice: settings.suppliesFee, amount: round2(settings.suppliesFee) });
  }

  return {
    ...addVat(lines, settings.vat),
    service: { slug: service.slug, name: service.name },
    size,
    estHours: cell.estHours ?? null,
    extras: extras.map(({ service: x, qty }) => ({ slug: x.slug, name: x.name, qty, unitPrice: x.rate })),
    supplies,
  };
}

module.exports = { priceBooking, sizePriceFor, extraBathrooms, publicService, resolveExtras, addVat, SUPPLIES };
