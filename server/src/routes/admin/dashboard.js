// Admin dashboard: today at a glance (Lagos time).
const express = require("express");
const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");
const Quote = require("../../models/Quote");
const Lead = require("../../models/Lead");
const { lagosDate, addDays, lagosToInstant } = require("../../lib/time");
const { round2 } = require("../../lib/money");

const ACTIVE = ["Confirmed", "Assigned", "In Progress", "Completed"];

async function revenueBetween(from, to) {
  const [r] = await Payment.aggregate([
    { $match: { status: { $in: ["success", "refunded"] }, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: round2(r?.total || 0), count: r?.count || 0 };
}

module.exports = function dashboardRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const today = lagosDate();
    const dayStart = lagosToInstant(today);
    const dayEnd = lagosToInstant(addDays(today, 1));
    const monthStart = lagosToInstant(`${today.slice(0, 8)}01`);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [todaysJobs, revenueToday, revenueMonth, newBookings, newQuotes, newLeads, awaitingPayment, unassigned, upcoming] = await Promise.all([
      Booking.find({ "schedule.date": today, status: { $in: ACTIVE } })
        .sort({ "schedule.time": 1 })
        .select("bookingId customer.firstName customer.lastName service schedule details.area status assignedWorkerName payment.status")
        .lean(),
      revenueBetween(dayStart, dayEnd),
      revenueBetween(monthStart, dayEnd),
      Booking.countDocuments({ createdAt: { $gte: weekAgo } }),
      Quote.countDocuments({ createdAt: { $gte: weekAgo } }),
      Lead.countDocuments({ stage: "new" }),
      Booking.countDocuments({ status: "Pending", "payment.status": "Pending" }),
      Booking.countDocuments({ status: "Confirmed", assignedWorker: null, "schedule.date": { $gte: today } }),
      Booking.find({ "schedule.date": { $gt: today, $lte: addDays(today, 7) }, status: { $in: ACTIVE } })
        .sort({ "schedule.date": 1, "schedule.time": 1 })
        .limit(10)
        .select("bookingId customer.firstName customer.lastName service schedule details.area status assignedWorkerName")
        .lean(),
    ]);

    res.json({ today, todaysJobs, revenueToday, revenueMonth, newBookings, newQuotes, newLeads, awaitingPayment, unassigned, upcoming });
  });

  return router;
};
