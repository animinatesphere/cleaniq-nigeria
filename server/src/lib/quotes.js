// Quote pricing, references and emails. Prices come from the price list; owners/managers may override a
// unit price or add a discount when building a quote by hand.
const crypto = require("node:crypto");
const Quote = require("../models/Quote");
const { round2, formatNaira } = require("./money");
const { addVat, FREQUENCIES } = require("./pricing");
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

// items: [{ serviceSlug, qty, option, unitPrice (override), extras: [{ slug, qty }] }]
function priceQuote(services, settings, { items = [], frequency = "once", supplies, discount = 0, extrasDiscountPct = 0, allowOverride = false }) {
  const errors = {};
  if (!Array.isArray(items) || !items.length || items.length > 15) throw badRequest("Add at least one service to the quote", { items: "Add at least one service" });
  const bySlug = new Map(services.filter((s) => s.active !== false).map((s) => [s.slug, s]));
  const out = [];
  items.forEach((it, i) => {
    const fail = (message) => {
      errors[`items.${i}`] = message;
    };
    const svc = bySlug.get(String(it?.serviceSlug || ""));
    if (!svc) return fail("Choose a service from the price list");
    const qty = Number(it.qty ?? 1);
    let unit;
    let option = "";
    if (svc.type === "hourly") {
      if (!(qty >= 1 && qty <= 100) || qty * 2 !== Math.round(qty * 2)) return fail("Hours must be 1–100 (whole or half hours)");
      const field = FREQUENCIES[frequency]?.field;
      unit = (field && Number(svc[field]) > 0 ? Number(svc[field]) : svc.rate);
    } else {
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) return fail("Quantity must be 1–100");
      if (svc.options?.length) {
        const opt = svc.options.find((o) => o.label === it.option);
        if (!opt) return fail(`Choose: ${svc.options.map((o) => o.label).join(", ")}`);
        unit = opt.rate;
        option = opt.label;
      } else unit = svc.rate;
    }
    if (allowOverride && it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== "") {
      const o = Number(it.unitPrice);
      if (!(o >= 0 && o <= 10_000_000)) return fail("Enter a valid price");
      unit = round2(o);
    }
    const extras = [];
    for (const e of Array.isArray(it.extras) ? it.extras : []) {
      const x = bySlug.get(String(e?.slug || ""));
      const q = Number(e?.qty ?? 1);
      if (!x || x.category !== "Extras" || !Number.isInteger(q) || q < 1 || q > 20) {
        errors[`items.${i}`] = "Check the add-ons";
        continue;
      }
      const xUnit = round2(x.rate * (1 - extrasDiscountPct / 100));
      extras.push({ slug: x.slug, name: x.name, qty: q, unitPrice: xUnit });
    }
    const subtotal = round2(unit * qty + extras.reduce((s, x) => s + x.unitPrice * x.qty, 0));
    out.push({ service: svc.name, serviceSlug: svc.slug, billingType: svc.type, qty, unitPrice: unit, option, extras, subtotal });
  });
  if (supplies === "cleaniq" && settings.suppliesFee > 0 && out.some((i) => i.billingType === "hourly")) {
    out.push({ service: "Cleaning supplies & equipment", serviceSlug: "supplies", billingType: "flat", qty: 1, unitPrice: settings.suppliesFee, option: "", extras: [], subtotal: round2(settings.suppliesFee) });
  }
  if (Object.keys(errors).length) throw badRequest("Please check the quote", errors);

  const gross = round2(out.reduce((s, i) => s + i.subtotal, 0));
  const disc = round2(Math.min(Math.max(Number(discount) || 0, 0), gross));
  const lines = [{ amount: round2(gross - disc) }];
  const v = addVat(lines, settings.vat);
  return { items: out, subtotal: gross, discount: disc, vat: v.vat, grandTotal: v.total };
}

function quoteEmails(config) {
  const link = (q, token) => `${config.frontendUrl}/quote/${q.quoteRef}?t=${token}`;
  const itemsTable = (q) => {
    const rows = q.items.map((i) => [
      `${i.service}${i.option ? ` (${i.option})` : ""} — ${i.billingType === "hourly" ? `${i.qty} hours` : `× ${i.qty}`}${i.extras?.length ? ` + ${i.extras.map((x) => `${x.name}${x.qty > 1 ? ` × ${x.qty}` : ""}`).join(", ")}` : ""}`,
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
