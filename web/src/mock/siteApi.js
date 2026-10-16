// Mock website API (used while there's no backend: VITE_MOCK_API=1). Prices use the same rules as the
// server (server/src/lib/pricing.js) on the sample price list; bookings are kept in this browser only
// and "payment" skips Paystack straight to the success page. Nothing is charged or sent.
import SITE from "./siteData.json";

const SERVICES = SITE.services;
const SIZE_TYPES = ["Flat", "Terrace", "Bungalow", "Duplex", "Mansion"];
const MAX_ROW = 6;
const bedroomLabel = (n) => (n === 0 ? "Self-contain" : n >= MAX_ROW ? `${MAX_ROW}+ bed` : `${n}-bed`);
const round2 = (n) => Math.round(n * 100) / 100;
const lagosToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STORE = "cleaniq-ng-mock-bookings";

class MockError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details || {}; }
}

function price(input = {}) {
  const errors = {};
  const service = SERVICES.base.find((s) => s.slug === input.service);
  if (!service) errors.service = "Please choose a service";
  else if (service.pricing !== "size") errors.service = "This service is priced after a quick look — please request a quote";
  const propertyType = String(input.propertyType || "");
  const bedrooms = Number(input.bedrooms ?? NaN);
  const bathrooms = Number(input.bathrooms ?? 0);
  if (!propertyType) errors.propertyType = "Please choose your property type";
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20) errors.bedrooms = "Please enter the number of bedrooms";
  let cell = null;
  if (service?.pricing === "size" && !errors.propertyType && !errors.bedrooms) {
    const row = Math.min(Math.max(0, bedrooms), MAX_ROW);
    cell = service.sizePrices.find((c) => c.propertyType === propertyType && c.bedrooms === row && c.price > 0) || null;
    if (!cell) {
      errors.propertyType = SIZE_TYPES.includes(propertyType)
        ? `We price a ${bedroomLabel(row)} ${propertyType.toLowerCase()} after a quick look — please request a quote`
        : "We price this property after a quick look — please request a quote";
      errors.needsQuote = true;
    }
  }
  const supplies = String(input.supplies || "");
  if (!["cleaniq", "customer"].includes(supplies)) errors.supplies = "Please tell us who's providing the cleaning supplies";
  if (Object.keys(errors).length) throw new MockError(errors.needsQuote ? "This one needs a quote" : "Please check your booking details", 400, errors);

  const size = `${bedroomLabel(cell.bedrooms)} ${propertyType}`;
  const extraBaths = Math.max(0, Math.floor(bathrooms) - Math.max(1, Math.floor(bedrooms)));
  const lines = [{ key: "service", label: `${service.name} — ${size}`, qty: 1, unitPrice: cell.price, amount: cell.price }];
  if (extraBaths && service.extraBathroomPrice > 0) lines.push({ key: "extra-bathrooms", label: "Extra bathrooms", qty: extraBaths, unitPrice: service.extraBathroomPrice, amount: round2(service.extraBathroomPrice * extraBaths) });
  const extras = (input.extras || []).map((e) => ({ x: SERVICES.extras.find((s) => s.slug === e.slug), qty: Number(e.qty) || 0 })).filter((e) => e.x && e.qty > 0);
  lines.push(...extras.map(({ x, qty }) => ({ key: `extra:${x.slug}`, label: x.name, qty, unitPrice: x.rate, amount: round2(x.rate * qty) })));
  if (supplies === "cleaniq" && SERVICES.suppliesFee > 0) lines.push({ key: "supplies", label: "Cleaning supplies & equipment", qty: 1, unitPrice: SERVICES.suppliesFee, amount: SERVICES.suppliesFee });
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vat = SERVICES.vat || {};
  const vatAmount = vat.enabled ? round2((subtotal * vat.rate) / 100) : 0;
  return {
    lines, subtotal, vat: { enabled: Boolean(vat.enabled), rate: vat.rate ?? 0, label: vat.label || "VAT", amount: vatAmount }, total: round2(subtotal + vatAmount), currency: "NGN",
    service: { slug: service.slug, name: service.name }, size, estHours: cell.estHours ?? null,
    extras: extras.map(({ x, qty }) => ({ slug: x.slug, name: x.name, qty, unitPrice: x.rate })), supplies,
  };
}

const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; } };
const writeStore = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ } };

function createBooking(body) {
  const errors = {};
  const need = { firstName: "Please enter your first name", lastName: "Please enter your last name", address: "Please enter the address", area: "Please choose your area", date: "Please choose a date", time: "Please choose a time" };
  for (const [k, msg] of Object.entries(need)) if (!String(body[k] || "").trim()) errors[k] = msg;
  if (!/^\S+@\S+\.\S+$/.test(String(body.email || ""))) errors.email = "Please enter a valid email";
  if (!String(body.phone || "").replace(/\D/g, "").match(/^(234|0)?[789]\d{9}$/)) errors.phone = "Please enter a Nigerian phone number";
  let p;
  try { p = price(body); } catch (e) { Object.assign(errors, e.details); }
  if (Object.keys(errors).length) throw new MockError("Please check your booking details", 400, errors);
  const bookingId = `NG-${Math.floor(100000 + Math.random() * 900000)}`;
  const reference = `${bookingId}-demo`;
  const store = readStore();
  store[bookingId] = { bookingId, reference, status: "Confirmed", paymentStatus: "Paid", service: p.service.name, date: body.date, time: body.time, total: p.total, currency: "NGN" };
  writeStore(store);
  // No Paystack in mock mode: go straight to the "payment successful" page.
  return { bookingId, reference, authorizationUrl: `/payment/success?booking=${bookingId}&reference=${reference}&demo=1`, total: p.total, currency: "NGN" };
}

export async function mockApi(path, { method = "GET", body } = {}) {
  await wait(method === "GET" ? 150 : 400);
  const [pathname] = path.split("?");
  if (pathname === "/services") return structuredClone(SERVICES);
  if (pathname === "/bookings/options") { const today = lagosToday(); return { ...SITE.options, minDate: addDays(today, 1), maxDate: addDays(today, 90) }; }
  if (pathname === "/bookings/quote-price" && method === "POST") return price(body);
  if (pathname === "/bookings" && method === "POST") return createBooking(body || {});
  const status = pathname.match(/^\/bookings\/([^/]+)\/status$/);
  if (status) { const b = readStore()[decodeURIComponent(status[1])]; if (!b) throw new MockError("Booking not found", 404); return b; }
  if (pathname === "/support" && method === "POST") {
    const errors = {};
    if (!String(body?.name || "").trim()) errors.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(String(body?.email || ""))) errors.email = "Enter a valid email";
    if (!String(body?.message || "").trim()) errors.message = "Write your message";
    if (Object.keys(errors).length) throw new MockError("Please check the form", 400, errors);
    return { ok: true, ref: `CHAT-${Math.floor(100000 + Math.random() * 900000)}` };
  }
  if (pathname.startsWith("/blog")) throw new MockError("No blog API in mock mode", 404); // blog shows its starter articles
  throw new MockError("Not available in demo mode", 404);
}
