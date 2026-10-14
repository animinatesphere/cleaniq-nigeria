// Admin → Price list / Services.
const express = require("express");
const Service = require("../../models/Service");
const { clean } = require("../../lib/text");
const { round2 } = require("../../lib/money");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");
const { SIZE_PROPERTY_TYPES, MAX_BEDROOM_ROW } = require("../../lib/lagos");

const MAX_PRICE = 10_000_000;
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function money(v, field, errors, { optional = false } = {}) {
  if (optional && (v === null || v === "" || v === undefined)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) {
    errors[field] = "Enter a price in naira";
    return undefined;
  }
  return round2(n);
}

function serviceInput(body, { partial, existing }) {
  const errors = {};
  const data = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has("name")) {
    data.name = clean(body.name, 80);
    if (data.name.length < 2) errors.name = "Enter a name";
  }
  if (has("category")) {
    if (!["Base", "Extras"].includes(body.category)) errors.category = "Choose main service or add-on";
    else data.category = body.category;
  }
  const category = data.category || existing?.category;
  if (body.pricing !== undefined || (!partial && category === "Base")) {
    if (!["size", "fixed", "quote"].includes(body.pricing)) errors.pricing = "Choose how it's priced";
    else data.pricing = category === "Extras" ? "fixed" : body.pricing;
  }
  if (category === "Extras") data.pricing = "fixed";
  if (body.rate !== undefined || (!partial && (data.pricing === "fixed"))) data.rate = money(body.rate ?? 0, "rate", errors);
  if (body.extraBathroomPrice !== undefined) data.extraBathroomPrice = money(body.extraBathroomPrice || 0, "extraBathroomPrice", errors);
  if (body.sizePrices !== undefined) {
    if (!Array.isArray(body.sizePrices) || body.sizePrices.length > SIZE_PROPERTY_TYPES.length * (MAX_BEDROOM_ROW + 1)) {
      errors.sizePrices = "Check the price table";
    } else {
      const seen = new Set();
      data.sizePrices = [];
      for (const c of body.sizePrices) {
        const key = `${c?.propertyType}:${c?.bedrooms}`;
        const bedrooms = Number(c?.bedrooms);
        if (!SIZE_PROPERTY_TYPES.includes(c?.propertyType) || !Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > MAX_BEDROOM_ROW || seen.has(key)) {
          errors.sizePrices = "Check the price table";
          break;
        }
        seen.add(key);
        if (c.price === null || c.price === "" || c.price === undefined) continue; // empty cell = priced by quote
        const price = money(c.price, `size.${key}`, errors);
        const est = c.estHours === null || c.estHours === "" || c.estHours === undefined ? null : Number(c.estHours);
        if (est !== null && !(est > 0 && est <= 24)) errors[`size.${key}`] = "Estimated hours must be 0–24";
        if (price !== undefined) data.sizePrices.push({ propertyType: c.propertyType, bedrooms, price, estHours: est });
      }
    }
  }
  if (body.unitLabel !== undefined) data.unitLabel = clean(body.unitLabel, 30);
  if (body.description !== undefined) data.description = clean(body.description, 300);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length > 10) errors.options = "Up to 10 options";
    else data.options = body.options.map((o, i) => ({ label: clean(o?.label, 40), rate: money(o?.rate, `options.${i}`, errors) })).filter((o) => o.label);
  }
  return { data, errors };
}

module.exports = function adminServiceRoutes({ auth }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");

  router.get("/", async (req, res) => {
    res.json({ items: await Service.find().sort({ category: 1, sortOrder: 1, name: 1 }).lean() });
  });

  router.post("/", managers, async (req, res) => {
    const { data, errors } = serviceInput(req.body || {}, { partial: false });
    if (Object.keys(errors).length) throw badRequest("Please check the service", errors);
    data.slug = slugify(req.body.slug || (data.category === "Extras" ? `extra-${data.name}` : data.name));
    if (await Service.exists({ slug: data.slug })) throw new HttpError(409, "A service with that name already exists");
    const s = await Service.create(data);
    await logAdmin(req, "service.create", s.slug, { rate: s.rate });
    res.status(201).json({ service: s });
  });

  router.patch("/:id", managers, async (req, res) => {
    const before = await Service.findById(req.params.id).lean();
    if (!before) throw notFound("Service not found");
    const { data, errors } = serviceInput(req.body || {}, { partial: true, existing: before });
    if (Object.keys(errors).length) throw badRequest("Please check the service", errors);
    const s = await Service.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    const changed = Object.fromEntries(
      Object.keys(data)
        .filter((k) => k !== "sizePrices" && JSON.stringify(before[k]) !== JSON.stringify(s[k]))
        .map((k) => [k, { from: before[k], to: s[k] }]),
    );
    if (data.sizePrices) {
      const key = (c) => `${c.bedrooms}-bed ${c.propertyType}`;
      const old = new Map((before.sizePrices || []).map((c) => [key(c), c.price]));
      const now = new Map(s.sizePrices.map((c) => [key(c), c.price]));
      const cells = [...new Set([...old.keys(), ...now.keys()])].filter((k) => old.get(k) !== now.get(k));
      if (cells.length) changed.sizePrices = Object.fromEntries(cells.map((k) => [k, { from: old.get(k) ?? null, to: now.get(k) ?? null }]));
    }
    await logAdmin(req, "service.update", s.slug, changed);
    res.json({ service: s });
  });

  router.delete("/:id", managers, async (req, res) => {
    const s = await Service.findById(req.params.id);
    if (!s) throw notFound("Service not found");
    await moveToBin(s, { label: `Service ${s.name}`, deletedBy: req.admin.name });
    await logAdmin(req, "service.delete", s.slug);
    res.json({ ok: true });
  });

  return router;
};
