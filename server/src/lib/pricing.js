// Server-side prices. The browser only sends choices (service, hours, extras…); every amount comes from here.
const { round2 } = require("./money");
const { badRequest } = require("../middleware/errors");

const FREQUENCIES = {
  once: { label: "One-off", field: null },
  weekly: { label: "Weekly", field: "weeklyRate" },
  fortnightly: { label: "Fortnightly", field: "fortnightlyRate" },
  monthly: { label: "Monthly", field: "monthlyRate" },
};
const SUPPLIES = { cleaniq: "Cleaniq brings supplies & equipment", customer: "Customer provides supplies" };
const MAX_HOURS = 12;
const MAX_EXTRA_QTY = 20;

// Frequencies a customer can choose for an hourly service, with the hourly price for each.
// One-off is always offered; regular ones only when admin has set their price.
function offeredFrequencies(service) {
  return Object.entries(FREQUENCIES)
    .map(([key, f]) => ({ key, label: f.label, rate: f.field ? Number(service[f.field]) || 0 : Number(service.rate) }))
    .filter((f) => f.key === "once" || f.rate > 0);
}

// What the public price list shows (no cleaner pay rates).
function publicService(s) {
  const base = {
    name: s.name, slug: s.slug, category: s.category, type: s.type, rate: s.rate,
    unitLabel: s.unitLabel || "", description: s.description || "",
    options: (s.options || []).map((o) => ({ label: o.label, rate: o.rate })),
  };
  if (s.type === "hourly") Object.assign(base, { minHours: s.minHours || 1, frequencies: offeredFrequencies(s) });
  return base;
}

// Merges repeated extras and checks each one exists. Returns [{ service, qty }].
function resolveExtras(services, extrasInput, errors) {
  if (extrasInput === undefined || extrasInput === null) return [];
  if (!Array.isArray(extrasInput) || extrasInput.length > 20) {
    errors.extras = "Please check the extras you chose";
    return [];
  }
  const bySlug = new Map(services.filter((s) => s.category === "Extras" && s.active !== false).map((s) => [s.slug, s]));
  const qtyBySlug = new Map();
  for (const e of extrasInput) {
    const svc = bySlug.get(String(e?.slug || ""));
    const qty = Number(e?.qty ?? 1);
    if (!svc) {
      errors.extras = "One of the extras you chose is no longer available";
      continue;
    }
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_EXTRA_QTY) {
      errors.extras = `Extras quantity must be between 1 and ${MAX_EXTRA_QTY}`;
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

// Price an hourly booking: hourly rate (for the chosen frequency) × hours + extras + supplies fee (+ VAT).
// Throws a 400 with per-field messages when the choices aren't valid.
function priceBooking(services, settings, input = {}) {
  const errors = {};
  const service = services.find((s) => s.slug === input.service && s.category === "Base" && s.type === "hourly" && s.active !== false);
  if (!service) errors.service = "Please choose a service";

  const frequency = String(input.frequency || "once");
  const offered = service ? offeredFrequencies(service) : [];
  const freq = offered.find((f) => f.key === frequency);
  if (service && !freq) errors.frequency = "That frequency isn't available for this service";

  const hours = Number(input.hours);
  const minHours = service?.minHours || 1;
  if (!Number.isFinite(hours) || hours * 2 !== Math.round(hours * 2) || hours < minHours || hours > MAX_HOURS) {
    errors.hours = `Please choose between ${minHours} and ${MAX_HOURS} hours`;
  }

  const supplies = String(input.supplies || "");
  if (!SUPPLIES[supplies]) errors.supplies = "Please tell us who's providing the cleaning supplies";

  const extras = resolveExtras(services, input.extras, errors);
  if (Object.keys(errors).length) throw badRequest("Please check your booking details", errors);

  const rate = freq.rate;
  const lines = [
    { key: "labour", label: `${service.name} — ${hours} hour${hours === 1 ? "" : "s"}${frequency === "once" ? "" : ` (${freq.label})`}`, qty: hours, unitPrice: rate, amount: round2(rate * hours) },
    ...extras.map(({ service: x, qty }) => ({ key: `extra:${x.slug}`, label: x.name, qty, unitPrice: x.rate, amount: round2(x.rate * qty) })),
  ];
  if (supplies === "cleaniq" && settings.suppliesFee > 0) {
    lines.push({ key: "supplies", label: "Cleaning supplies & equipment", qty: 1, unitPrice: settings.suppliesFee, amount: round2(settings.suppliesFee) });
  }

  return {
    ...addVat(lines, settings.vat),
    service: { slug: service.slug, name: service.name },
    frequency: { key: frequency, label: freq.label },
    hours,
    hourlyRate: rate,
    extras: extras.map(({ service: x, qty }) => ({ slug: x.slug, name: x.name, qty, unitPrice: x.rate })),
    supplies,
  };
}

module.exports = { priceBooking, offeredFrequencies, publicService, resolveExtras, addVat, FREQUENCIES, SUPPLIES, MAX_HOURS };
