// Admin → Payments (every Paystack/offline payment) and refunds.
const express = require("express");
const Payment = require("../../models/Payment");
const Booking = require("../../models/Booking");
const { paging, searchFilter } = require("../../lib/query");
const { isValidDate, lagosToInstant, addDays } = require("../../lib/time");
const { round2 } = require("../../lib/money");

module.exports = function adminPaymentRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["reference", "bookingId", "email", "channel"]);
    if (["success", "failed", "refunded", "mismatch"].includes(req.query.status)) filter.status = req.query.status;
    if (isValidDate(req.query.from) || isValidDate(req.query.to)) {
      filter.paidAt = {};
      if (isValidDate(req.query.from)) filter.paidAt.$gte = lagosToInstant(req.query.from);
      if (isValidDate(req.query.to)) filter.paidAt.$lt = lagosToInstant(addDays(req.query.to, 1));
    }
    const [items, total, sums] = await Promise.all([
      Payment.find(filter).sort({ paidAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $match: filter }, { $group: { _id: "$status", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    ]);
    const refunds = await Booking.find({ "payment.refund.requestedAt": { $ne: null } })
      .sort({ "payment.refund.requestedAt": -1 })
      .limit(50)
      .select("bookingId customer.firstName customer.lastName payment.status payment.refund")
      .lean();
    res.json({ items, total, page, limit, totals: Object.fromEntries(sums.map((s) => [s._id, { amount: round2(s.amount), count: s.n }])), refunds });
  });

  return router;
};
