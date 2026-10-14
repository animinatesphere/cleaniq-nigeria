// Admin → Quote builder and quote history.
const express = require("express");
const Quote = require("../../models/Quote");
const Service = require("../../models/Service");
const { priceQuote, quoteEmails, newQuoteRef, newToken, expireQuotes, VALID_DAYS } = require("../../lib/quotes");
const { getPricingSettings } = require("../../lib/settings");
const { clean, normaliseEmail, isEmail, normaliseNgPhone } = require("../../lib/text");
const { isValidDate, isValidTime } = require("../../lib/time");
const { LAGOS_AREAS, PROPERTY_TYPES } = require("../../lib/lagos");
const { SUPPLIES } = require("../../lib/pricing");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { badRequest, notFound } = require("../../middleware/errors");
const Lead = require("../../models/Lead");

function count(v) {
  const n = Number(v ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : 0;
}

function quoteCustomerInput(b) {
  const errors = {};
  const customer = { firstName: clean(b.firstName, 50), lastName: clean(b.lastName, 50), email: normaliseEmail(b.email), phone: b.phone ? normaliseNgPhone(b.phone) : "" };
  if (customer.firstName.length < 2) errors.firstName = "Enter the customer's first name";
  if (!isEmail(customer.email)) errors.email = "Enter a valid email";
  if (b.phone && !customer.phone) errors.phone = "Enter a Nigerian mobile number";
  const details = {
    area: clean(b.area, 60), address: clean(b.address, 200), landmark: clean(b.landmark, 100),
    propertyType: PROPERTY_TYPES.includes(b.propertyType) ? b.propertyType : "",
    rooms: { bedrooms: count(b.bedrooms), bathrooms: count(b.bathrooms), kitchens: count(b.kitchens), livingRooms: count(b.livingRooms), stairs: count(b.stairs) },
    pets: typeof b.pets === "boolean" ? b.pets : undefined,
    supplies: SUPPLIES[b.supplies] ? b.supplies : "",
    notes: clean(b.notes, 1000),
  };
  if (!LAGOS_AREAS.includes(details.area)) errors.area = "Choose the area in Lagos";
  const serviceDate = isValidDate(b.serviceDate) ? b.serviceDate : "";
  const serviceTime = isValidTime(b.serviceTime) ? b.serviceTime : "";
  return { customer, details, serviceDate, serviceTime, errors };
}

module.exports = function adminQuoteRoutes({ auth, mailer, config }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const emails = quoteEmails(config);

  async function sendQuote(q) {
    const withToken = await Quote.findById(q._id).select("+token");
    const r = await mailer.send({ to: q.customer.email, ref: q.quoteRef, ...emails.quote(q, withToken.token) });
    await Quote.updateOne({ _id: q._id }, { $inc: { sentCount: 1 }, $set: { lastSentAt: new Date() } });
    return r;
  }

  router.get("/", async (req, res) => {
    await expireQuotes();
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["quoteRef", "customer.firstName", "customer.lastName", "customer.email", "details.area"]);
    if (Quote.STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const [items, total, counts] = await Promise.all([
      Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("quoteRef customer status grandTotal validUntil serviceDate createdAt bookingId source sentCount").lean(),
      Quote.countDocuments(filter),
      Quote.aggregate([{ $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$grandTotal" } } }]),
    ]);
    res.json({ items, total, page, limit, counts: Object.fromEntries(counts.map((c) => [c._id, { count: c.n, value: c.value }])) });
  });

  // Live total for the quote builder.
  router.post("/price", async (req, res) => {
    const [services, settings] = await Promise.all([Service.find({ active: true }).lean(), getPricingSettings()]);
    const canOverride = ["owner", "manager"].includes(req.admin.role);
    res.json(priceQuote(services, settings, { items: req.body?.items, supplies: req.body?.supplies, discount: req.body?.discount, canOverride }));
  });

  router.post("/", async (req, res) => {
    const b = req.body || {};
    const { customer, details, serviceDate, serviceTime, errors } = quoteCustomerInput(b);
    const [services, settings] = await Promise.all([Service.find({ active: true }).lean(), getPricingSettings()]);
    const canOverride = ["owner", "manager"].includes(req.admin.role);
    let priced;
    try {
      priced = priceQuote(services, settings, { items: b.items, supplies: details.supplies, discount: b.discount, canOverride });
    } catch (e) {
      if (!e.details) throw e;
      Object.assign(errors, e.details);
    }
    if (Object.keys(errors).length) throw badRequest("Please check the quote", errors);

    const q = await Quote.create({
      quoteRef: await newQuoteRef(), token: newToken(), customer, details, serviceDate, serviceTime,
      items: priced.items, subtotal: priced.subtotal, discount: { label: clean(b.discountLabel, 40) || "Discount", amount: priced.discount },
      vat: priced.vat, grandTotal: priced.grandTotal, status: "Sent",
      validUntil: new Date(Date.now() + VALID_DAYS * 24 * 3600 * 1000), source: "admin", createdBy: req.admin.name,
    });
    await Lead.create({ name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone, area: details.area, source: "quote", stage: "quoted", ref: q.quoteRef }).catch(() => {});
    if (b.send !== false) await sendQuote(q);
    await logAdmin(req, "quote.create", q.quoteRef, { total: q.grandTotal });
    res.status(201).json({ quote: await Quote.findById(q._id).lean() });
  });

  router.get("/:ref", async (req, res) => {
    await expireQuotes();
    const q = await Quote.findOne({ quoteRef: String(req.params.ref) }).lean();
    if (!q) throw notFound("Quote not found");
    res.json({ quote: q });
  });

  // Resend: also gives an expired quote another 30 days.
  router.post("/:ref/resend", async (req, res) => {
    const q = await Quote.findOne({ quoteRef: String(req.params.ref) });
    if (!q) throw notFound("Quote not found");
    if (!["Sent", "Expired"].includes(q.status)) throw badRequest(`This quote is ${q.status.toLowerCase()}`);
    q.status = "Sent";
    q.validUntil = new Date(Date.now() + VALID_DAYS * 24 * 3600 * 1000);
    await q.save();
    const r = await sendQuote(q);
    await logAdmin(req, "quote.resend", q.quoteRef);
    res.json({ ok: r.status !== "failed", quote: await Quote.findById(q._id).lean() });
  });

  router.post("/:ref/decline", async (req, res) => {
    const q = await Quote.findOneAndUpdate(
      { quoteRef: String(req.params.ref), status: { $in: ["Sent", "Expired"] } },
      { $set: { status: "Declined", declinedAt: new Date(), followUpsStopped: true } },
      { new: true },
    );
    if (!q) throw badRequest("Only open quotes can be marked declined");
    await Lead.updateMany({ ref: q.quoteRef }, { $set: { stage: "lost" } });
    await logAdmin(req, "quote.decline", q.quoteRef);
    res.json({ quote: q });
  });

  router.delete("/:ref", managers, async (req, res) => {
    const q = await Quote.findOne({ quoteRef: String(req.params.ref) }).select("+token");
    if (!q) throw notFound("Quote not found");
    await moveToBin(q, { label: `Quote ${q.quoteRef} — ${q.customer.firstName} ${q.customer.lastName}`, deletedBy: req.admin.name });
    await logAdmin(req, "quote.delete", q.quoteRef);
    res.json({ ok: true });
  });

  return router;
};
