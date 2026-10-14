// Admin → Expense tracker: what the business spends (used for profit in Analytics).
const express = require("express");
const Expense = require("../../models/Expense");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { clean } = require("../../lib/text");
const { isValidDate, lagosDate } = require("../../lib/time");
const { round2 } = require("../../lib/money");
const { badRequest, notFound } = require("../../middleware/errors");

const CATEGORIES = ["Supplies", "Equipment", "Transport", "Fuel", "Marketing", "Rent", "Salaries", "Software", "Data & airtime", "Bank charges", "Tax", "Other"];

function readExpense(body, { partial } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has("date")) { out.date = String(body.date || ""); if (!isValidDate(out.date)) errors.date = "Choose a date"; }
  if (has("amount")) { out.amount = round2(Number(body.amount)); if (!(out.amount > 0)) errors.amount = "Enter the amount"; }
  if (has("category")) out.category = CATEGORIES.includes(body.category) ? body.category : "Other";
  if (body.note !== undefined) out.note = clean(body.note, 300);
  return { out, errors };
}

module.exports = function adminExpenseRoutes() {
  const router = express.Router();

  const load = async (id) => {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound("Expense not found");
    const doc = await Expense.findById(id);
    if (!doc) throw notFound("Expense not found");
    return doc;
  };

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : lagosDate().slice(0, 7);
    const filter = { ...searchFilter(req.query.q, ["note", "category"]), date: { $gte: `${month}-01`, $lte: `${month}-31` } };
    if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    const monthOnly = { date: filter.date };
    const [items, total, byCategory, sum] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([{ $match: monthOnly }, { $group: { _id: "$category", total: { $sum: "$amount" }, n: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Expense.aggregate([{ $match: monthOnly }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    res.json({
      items, total, page, limit, month, categories: CATEGORIES,
      monthTotal: round2(sum[0]?.total || 0),
      byCategory: byCategory.map((c) => ({ category: c._id, total: round2(c.total), count: c.n })),
    });
  });

  router.post("/", async (req, res) => {
    const { out, errors } = readExpense(req.body || {});
    if (Object.keys(errors).length) throw badRequest("Please check the expense", errors);
    const doc = await Expense.create({ ...out, createdBy: req.admin.name });
    await logAdmin(req, "expense.create", String(doc._id), { amount: doc.amount, category: doc.category });
    res.status(201).json({ expense: doc });
  });

  router.patch("/:id", async (req, res) => {
    const doc = await load(req.params.id);
    const { out, errors } = readExpense(req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the expense", errors);
    doc.set(out);
    await doc.save();
    await logAdmin(req, "expense.update", String(doc._id), out);
    res.json({ expense: doc });
  });

  router.delete("/:id", async (req, res) => {
    const doc = await load(req.params.id);
    await moveToBin(doc, { label: `Expense ${doc.category} ₦${doc.amount} (${doc.date})`, deletedBy: req.admin.name });
    await logAdmin(req, "expense.delete", String(doc._id));
    res.json({ ok: true });
  });

  return router;
};
