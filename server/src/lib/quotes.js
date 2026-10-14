// Quote pricing, references and emails. Prices come from the price list; owners/managers may override a
// unit price or add a discount when building a quote by hand.
const crypto = require("node:crypto");
const Quote = require("../models/Quote");
const { round2, formatNaira } = require("./money");
const { addVat, sizePriceFor, extraBathrooms } = require("./pricing");
const { bedroomLabel, MAX_BEDROOM_ROW } = require("./lagos");
const { layout, detailsTable } = require("./email");
const { escapeHtml } = require("./text");
const { formatLagosDate, formatTime } = require("./time");
const { badRequest } = require("../middleware/errors");

const VALID_DAYS = 30;

async function newQuoteRef() {
  for (let i = 0; i < 10; i++) {
    const ref = `Q-NG-${crypto.randomInt(100000, 1000000)}`;
    if (!(await Quote.exists({ quoteRef: ref }))) return ref;
  }
  throw new Error("Could not create a quote reference");
}
const newToken = () => crypto.randomBytes(16).toString("hex");

// items: [{ serviceSlug, propertyType, bedrooms, bathrooms, qty, option, unitPrice, extras: [{ slug, qty }] }]
//     or custom lines: [{ label, unitPrice, qty }]
// canOverride (owners/managers): may change a price-list price and give a discount.
// Any admin may price "quote" services (post-construction) and add custom lines — that's what quoting is.
function priceQuote(services, settings, { items = [], supplies, discount = 0, extrasDiscountPct = 0, canOverride = false }) {
  const errors = {};
  if (!Array.isArray(items) || !items.length || items.length > 15) throw badRequest("Add at least one line to the quote", { items: "Add at least one line" });
  const bySlug = new Map(services.filter((s) => s.active !== false).map((s) => [s.slug, s]));
  const givenPrice = (it) => (it.unitPrice === undefined || it.unitPrice === null || it.unitPrice === "" ? null : Number(it.unitPrice));
  const out = [];
  items.forEach((it, i) => {
    const fail = (message) => {
      errors[`items.${i}`] = message;
    };
    const qty = Number(it?.qty ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) return fail("Quantity must be 1–100");
    const priced = givenPrice(it || {});
    if (priced !== null && !(priced >= 0 && priced <= 50_000_000)) return fail("Enter a valid price");

    // Custom line
    if (!it?.serviceSlug) {
      const label = String(it?.label || "").replace(/<[^>]*>?/g, "").trim().slice(0, 120);
      if (!label) return fail("Describe the custom line");
      if (priced === null) return fail("Enter a price for the custom line");
      return void out.push({ service: label, serviceSlug: "", kind: "custom", size: "", qty, unitPrice: round2(priced), option: "", extras: [], subtotal: round2(priced * qty) });
    }

    const svc = bySlug.get(String(it.serviceSlug));
    if (!svc || svc.category !== "Base") return fail("Choose a service from the price list");
    let unit;
    let size = "";
    let option = "";
    let estHours;
    let kind = svc.pricing;
    if (svc.pricing === "size") {
      const bedrooms = Number(it.bedrooms ?? 0);
      const cell = sizePriceFor(svc, it.propertyType, bedrooms);
      size = `${bedroomLabel(Math.min(Math.max(0, bedrooms), MAX_BEDROOM_ROW))} ${it.propertyType || ""}`.trim();
      if (cell) {
        unit = cell.price + (svc.extraBathroomPrice || 0) * extraBathrooms(bedrooms, it.bathrooms);
        estHours = cell.estHours ?? undefined;
        if (priced !== null && canOverride) unit = priced;
      } else if (priced !== null) {
        unit = priced; // not in the table — the person quoting sets the price
        kind = "quote";
      } else return fail(`No list price for a ${size} — enter a price`);
    } else if (svc.pricing === "fixed") {
      if (svc.options?.length) {
        const opt = svc.options.find((o) => o.label === it.option);
        if (!opt) return fail(`Choose: ${svc.options.map((o) => o.label).join(", ")}`);
        unit = opt.rate;
        option = opt.label;
      } else unit = svc.rate;
      if (priced !== null && canOverride) unit = priced;
    } else {
      if (priced === null) return fail("Enter the price for this job");
      unit = priced;
    }
    const extras = [];
    for (const e of Array.isArray(it.extras) ? it.extras : []) {
      const x = bySlug.get(String(e?.slug || ""));
      const q = Number(e?.qty ?? 1);
      if (!x || x.category !== "Extras" || !Number.isInteger(q) || q < 1 || q > 20) {
        fail("Check the add-ons");
        continue;
      }
      extras.push({ slug: x.slug, name: x.name, qty: q, unitPrice: round2(x.rate * (1 - extrasDiscountPct / 100)) });
    }
    const subtotal = round2(unit * qty + extras.reduce((s, x) => s + x.unitPrice * x.qty, 0));
    out.push({ service: svc.name, serviceSlug: svc.slug, kind, size, estHours, qty, unitPrice: round2(unit), option, extras, subtotal });
  });
  if (supplies === "cleaniq" && settings.suppliesFee > 0 && out.some((i) => i.kind === "size")) {
    const visits = out.filter((i) => i.kind === "size").reduce((s, i) => s + i.qty, 0);
    out.push({ service: "Cleaning supplies & equipment", serviceSlug: "supplies", kind: "fixed", size: "", qty: visits, unitPrice: settings.suppliesFee, option: "", extras: [], subtotal: round2(settings.suppliesFee * visits) });
  }
  if (Object.keys(errors).length) throw badRequest("Please check the quote", errors);

  const gross = round2(out.reduce((s, i) => s + i.subtotal, 0));
  const disc = canOverride ? round2(Math.min(Math.max(Number(discount) || 0, 0), gross)) : 0;
  const v = addVat([{ amount: round2(gross - disc) }], settings.vat);
  return { items: out, subtotal: gross, discount: disc, vat: v.vat, grandTotal: v.total };
}

function quoteEmails(config) {
  const link = (q, token) => `${config.frontendUrl}/quote/${q.quoteRef}?t=${token}`;
  const itemsTable = (q) => {
    const rows = q.items.map((i) => [
      `${i.service}${i.size ? ` — ${i.size}` : ""}${i.option ? ` (${i.option})` : ""}${i.qty > 1 ? ` × ${i.qty}` : ""}${i.extras?.length ? ` + ${i.extras.map((x) => `${x.name}${x.qty > 1 ? ` × ${x.qty}` : ""}`).join(", ")}` : ""}`,
      formatNaira(i.subtotal),
    ]);
    if (q.discount?.amount) rows.push([q.discount.label || "Discount", `−${formatNaira(q.discount.amount)}`]);
    if (q.vat?.enabled) rows.push([`${q.vat.label} (${q.vat.rate}%)`, formatNaira(q.vat.amount)]);
    rows.push(["Total", formatNaira(q.grandTotal)]);
    return detailsTable(rows);
  };
  return {
    quote: (q, token) => ({
      subject: `Your Cleaniq quote ${q.quoteRef}: ${formatNaira(q.grandTotal)}`,
      type: "quote",
      html: layout(config, {
        title: "Your cleaning quote",
        intro: `Hi ${escapeHtml(q.customer?.firstName || "there")}, thanks for asking Cleaniq. Here's your quote — it's valid until <strong>${escapeHtml(q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : "")}</strong>.`,
        bodyHtml:
          itemsTable(q) +
          detailsTable([
            ["Quote reference", q.quoteRef],
            ["Area", q.details?.area],
            ["Preferred date", q.serviceDate ? `${formatLagosDate(q.serviceDate)}${q.serviceTime ? ` at ${formatTime(q.serviceTime)}` : ""}` : ""],
          ]) +
          `<p style="font-size:14px;color:#334155;line-height:1.6">Press <strong>Accept</strong> to choose your date and time and pay securely with Paystack.</p>`,
        button: { label: "Accept my quote", url: link(q, token) },
      }),
    }),
    team: (q) => ({
      subject: `Quote ${q.quoteRef} sent: ${formatNaira(q.grandTotal)} to ${q.customer?.firstName} ${q.customer?.lastName}`,
      type: "team-quote",
      html: layout(config, { title: `Quote ${q.quoteRef}`, bodyHtml: itemsTable(q) + detailsTable([["Customer", `${q.customer?.firstName} ${q.customer?.lastName}`], ["Email", q.customer?.email], ["Phone", q.customer?.phone], ["Area", q.details?.area]]) }),
    }),
  };
}

// Marks out-of-date quotes as Expired (run before listing/reading — no background job needed).
const expireQuotes = (now = new Date()) => Quote.updateMany({ status: "Sent", validUntil: { $lt: now } }, { $set: { status: "Expired" } });

module.exports = { priceQuote, quoteEmails, newQuoteRef, newToken, expireQuotes, VALID_DAYS };
