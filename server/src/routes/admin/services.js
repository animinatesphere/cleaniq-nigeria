// Admin → Price list / Services.
const express = require("express");
const Service = require("../../models/Service");
const { clean } = require("../../lib/text");
const { round2 } = require("../../lib/money");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");

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

function serviceInput(body, { partial }) {
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
  if (has("type")) {
    if (!["hourly", "flat"].includes(body.type)) errors.type = "Choose hourly or fixed price";
    else data.type = body.type;
  }
  if (has("rate")) data.rate = money(body.rate, "rate", errors);
  for (const k of ["weeklyRate", "fortnightlyRate", "monthlyRate"]) if (body[k] !== undefined) data[k] = money(body[k], k, errors, { optional: true });
  for (const k of ["workerHourlyRate", "workerPaymentRate"]) if (body[k] !== undefined) data[k] = money(body[k] || 0, k, errors);
  if (body.minHours !== undefined) {
    const n = Number(body.minHours);
    if (!(n >= 1 && n <= 12) || n * 2 !== Math.round(n * 2)) errors.minHours = "Minimum hours must be 1–12";
    else data.minHours = n;
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
    const { data, errors } = serviceInput(req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the service", errors);
    const before = await Service.findById(req.params.id).lean();
    if (!before) throw notFound("Service not found");
    const s = await Service.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    const changed = Object.fromEntries(Object.keys(data).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(s[k])).map((k) => [k, { from: before[k], to: s[k] }]));
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
