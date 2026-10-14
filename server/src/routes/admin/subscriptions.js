// Admin → Monthly plans: a fixed monthly price for regular cleans, billed in advance each month.
const express = require("express");
const crypto = require("crypto");
const Subscription = require("../../models/Subscription");
const Customer = require("../../models/Customer");
const Worker = require("../../models/Worker");
const Invoice = require("../../models/Invoice");
const { billSubscription } = require("../../lib/invoices");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { clean, isEmail, normaliseEmail, normaliseNgPhone } = require("../../lib/text");
const { isValidDate, lagosDate } = require("../../lib/time");
const { round2 } = require("../../lib/money");
const { badRequest, notFound } = require("../../middleware/errors");

module.exports = function adminSubscriptionRoutes(ctx) {
  const router = express.Router();
  const managers = ctx.auth.requireAdmin("owner", "manager");

  const load = async (id) => {
    const doc = /^[a-f0-9]{24}$/i.test(id) ? await Subscription.findById(id) : await Subscription.findOne({ ref: id });
    if (!doc) throw notFound("Plan not found");
    return doc;
  };

  function readPlan(body, { partial } = {}) {
    const errors = {};
    const out = {};
    const has = (k) => !partial || body[k] !== undefined;
    if (has("service")) { out.service = clean(body.service, 80); if (!out.service) errors.service = "Choose the service"; }
    if (has("cleans") || has("per")) {
      const cleans = Math.floor(Number(body.cleans));
      const per = body.per === "week" ? "week" : "month";
      if (!(cleans >= 1 && cleans <= 31)) errors.cleans = "1–31 cleans";
      out.plan = { cleans, per };
    }
    if (has("monthlyPrice")) { out.monthlyPrice = round2(Number(body.monthlyPrice)); if (!(out.monthlyPrice > 0)) errors.monthlyPrice = "Enter the monthly price"; }
    if (has("nextBillingDate")) { out.nextBillingDate = String(body.nextBillingDate || ""); if (!isValidDate(out.nextBillingDate)) errors.nextBillingDate = "Choose the first billing date"; }
    if (body.area !== undefined) out.area = clean(body.area, 60);
    if (body.address !== undefined) out.address = clean(body.address, 200);
    if (body.regularWorker !== undefined) out.regularWorker = body.regularWorker || null;
    return { out, errors };
  }

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["ref", "customerName", "customerEmail", "customerPhone", "service", "area"]);
    if (["active", "paused", "payment_due", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total, sums] = await Promise.all([
      Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("regularWorker", "firstName lastName").lean(),
      Subscription.countDocuments(filter),
      Subscription.aggregate([{ $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$monthlyPrice" } } }]),
    ]);
    res.json({ items, total, page, limit, counts: Object.fromEntries(sums.map((s) => [s._id, { count: s.n, value: round2(s.value) }])) });
  });

  router.post("/", managers, async (req, res) => {
    const b = req.body || {};
    const { out, errors } = readPlan(b);
    const email = normaliseEmail(b.email);
    const name = clean(b.name, 80);
    if (!name) errors.name = "Enter the customer's name";
    if (!isEmail(email)) errors.email = "Enter a valid email";
    const phone = b.phone ? normaliseNgPhone(b.phone) : "";
    if (b.phone && !phone) errors.phone = "Enter a Nigerian phone number";
    if (out.regularWorker && !(await Worker.exists({ _id: out.regularWorker }))) errors.regularWorker = "Choose a cleaner";
    if (Object.keys(errors).length) throw badRequest("Please check the plan", errors);
    const [firstName, ...rest] = name.split(" ");
    const customer = await Customer.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, firstName, lastName: rest.join(" "), phone, area: out.area || "", address: out.address || "" } },
      { upsert: true, new: true },
    );
    const sub = await Subscription.create({
      ...out, ref: `PLAN-${crypto.randomInt(100000, 1000000)}`, customer: customer._id, customerName: name, customerEmail: email, customerPhone: phone,
      billingDay: Math.min(28, Number(out.nextBillingDate.slice(8, 10))), status: "active",
    });
    await logAdmin(req, "plan.create", sub.ref, { monthlyPrice: sub.monthlyPrice });
    // Bill the first month straight away when it starts today or earlier.
    if (b.billNow !== false && out.nextBillingDate <= lagosDate()) await billSubscription(ctx, sub, { createdBy: req.admin.name });
    res.status(201).json({ subscription: await Subscription.findById(sub._id) });
  });

  router.get("/:id", async (req, res) => {
    const sub = await load(req.params.id);
    await sub.populate("regularWorker", "firstName lastName phone");
    const invoices = await Invoice.find({ subscription: sub._id }).sort({ createdAt: -1 }).limit(24).lean();
    res.json({ subscription: sub, invoices });
  });

  router.patch("/:id", managers, async (req, res) => {
    const sub = await load(req.params.id);
    const { out, errors } = readPlan(req.body || {}, { partial: true });
    if (out.regularWorker && !(await Worker.exists({ _id: out.regularWorker }))) errors.regularWorker = "Choose a cleaner";
    if (Object.keys(errors).length) throw badRequest("Please check the plan", errors);
    sub.set(out);
    await sub.save();
    await logAdmin(req, "plan.update", sub.ref, Object.keys(out));
    res.json({ subscription: sub });
  });

  router.post("/:id/bill", managers, async (req, res) => {
    const sub = await load(req.params.id);
    if (["cancelled", "paused"].includes(sub.status)) throw badRequest(`This plan is ${sub.status}`);
    const invoice = await billSubscription(ctx, sub, { createdBy: req.admin.name });
    await logAdmin(req, "plan.bill", sub.ref, { invoice: invoice.invoiceNo });
    res.json({ invoice, subscription: await Subscription.findById(sub._id) });
  });

  // pause | resume | cancel
  router.post("/:id/:action", managers, async (req, res) => {
    const sub = await load(req.params.id);
    const { action } = req.params;
    if (!["pause", "resume", "cancel"].includes(action)) throw notFound();
    if (sub.status === "cancelled") throw badRequest("This plan is cancelled");
    if (action === "pause") sub.status = "paused";
    if (action === "resume") {
      if (sub.status !== "paused") throw badRequest("This plan isn't paused");
      sub.status = "active";
      if (!sub.nextBillingDate || sub.nextBillingDate < lagosDate()) sub.nextBillingDate = lagosDate();
    }
    if (action === "cancel") { sub.status = "cancelled"; sub.cancelledAt = new Date(); }
    await sub.save();
    await logAdmin(req, `plan.${action}`, sub.ref);
    res.json({ subscription: sub });
  });

  return router;
};
