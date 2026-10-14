// Admin → Analytics (company revenue, profit, where the money comes from) and Cleaner performance.
const express = require("express");
const Payment = require("../../models/Payment");
const Booking = require("../../models/Booking");
const Invoice = require("../../models/Invoice");
const Expense = require("../../models/Expense");
const Withdrawal = require("../../models/Withdrawal");
const Subscription = require("../../models/Subscription");
const Customer = require("../../models/Customer");
const Worker = require("../../models/Worker");
const Record = require("../../models/Record");
const { lagosDate, addDays, lagosToInstant } = require("../../lib/time");
const { round2 } = require("../../lib/money");

const TZ = "+01:00"; // Lagos
const PLAN_LABELS = { payNow: "Pay now", payAfter: "Pay after clean", weekly: "Weekly bill", subscription: "Monthly plan", link: "Payment link", manual: "Invoice" };

function lastMonths(n, today = lagosDate()) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthEnd = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r._id, r]));

module.exports = function adminAnalyticsRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const n = [3, 6, 12, 24].includes(Number(req.query.months)) ? Number(req.query.months) : 12;
    const today = lagosDate();
    const months = lastMonths(n, today);
    const from = lagosToInstant(`${months[0]}-01`);
    const to = lagosToInstant(addDays(today, 1));
    const monthOf = (field) => ({ $dateToString: { format: "%Y-%m", date: field, timezone: TZ } });
    const paid = { status: { $in: ["success", "refunded"] }, paidAt: { $gte: from, $lt: to } };
    const dayFrom = addDays(today, -29);

    const [rev, refunds, exp, pay, jobs, daily, payments, services, areas, mrr, outstanding, customers, newCustomers, repeat] = await Promise.all([
      Payment.aggregate([{ $match: paid }, { $group: { _id: monthOf("$paidAt"), total: { $sum: "$amount" }, n: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: { "payment.refund.status": "processed", "payment.refund.processedAt": { $gte: from, $lt: to } } }, { $group: { _id: monthOf("$payment.refund.processedAt"), total: { $sum: "$payment.refund.amount" } } }]),
      Expense.aggregate([{ $match: { date: { $gte: `${months[0]}-01`, $lte: today } } }, { $group: { _id: { $substr: ["$date", 0, 7] }, total: { $sum: "$amount" } } }]),
      Withdrawal.aggregate([{ $match: { status: "Paid", paidAt: { $gte: from, $lt: to } } }, { $group: { _id: monthOf("$paidAt"), total: { $sum: "$amount" } } }]),
      Booking.aggregate([{ $match: { status: "Completed", "schedule.date": { $gte: `${months[0]}-01`, $lte: today } } }, { $group: { _id: { $substr: ["$schedule.date", 0, 7] }, n: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: { status: { $in: ["success", "refunded"] }, paidAt: { $gte: lagosToInstant(dayFrom), $lt: to } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: TZ } }, total: { $sum: "$amount" } } }]),
      Payment.find(paid).select("bookingId amount").lean(),
      Booking.aggregate([{ $match: { "payment.status": "Paid", "payment.paidAt": { $gte: from, $lt: to } } }, { $group: { _id: "$service", total: { $sum: "$payment.amount" }, n: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 8 }]),
      Booking.aggregate([{ $match: { "payment.status": "Paid", "payment.paidAt": { $gte: from, $lt: to } } }, { $group: { _id: "$details.area", total: { $sum: "$payment.amount" }, n: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 8 }]),
      Subscription.aggregate([{ $match: { status: { $in: ["active", "payment_due"] } } }, { $group: { _id: null, total: { $sum: "$monthlyPrice" }, n: { $sum: 1 } } }]),
      Invoice.aggregate([{ $match: { status: "Unpaid" } }, { $group: { _id: { $cond: [{ $lt: ["$dueDate", today] }, "overdue", "due"] }, total: { $sum: "$total" }, n: { $sum: 1 } } }]),
      Customer.countDocuments(),
      Customer.countDocuments({ createdAt: { $gte: lagosToInstant(`${today.slice(0, 7)}-01`) } }),
      Booking.aggregate([{ $match: { status: { $ne: "Cancelled" } } }, { $group: { _id: "$customer.email", n: { $sum: 1 } } }, { $group: { _id: null, customers: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ["$n", 1] }, 1, 0] } } } }]),
    ]);

    // Where the money came from: booking payment plan, or the invoice kind.
    const invNos = payments.filter((p) => /^INV-/.test(p.bookingId || "")).map((p) => p.bookingId);
    const bookIds = payments.filter((p) => p.bookingId && !/^INV-/.test(p.bookingId)).map((p) => p.bookingId);
    const [invKinds, bookPlans] = await Promise.all([
      Invoice.find({ invoiceNo: { $in: invNos } }).select("invoiceNo kind").lean(),
      Booking.find({ bookingId: { $in: bookIds } }).select("bookingId payment.plan").lean(),
    ]);
    const kindOf = Object.fromEntries([...invKinds.map((i) => [i.invoiceNo, i.kind]), ...bookPlans.map((b) => [b.bookingId, b.payment?.plan || "payNow"])]);
    const bySource = {};
    for (const p of payments) {
      const label = PLAN_LABELS[kindOf[p.bookingId] || "payNow"];
      bySource[label] = round2((bySource[label] || 0) + (p.amount || 0));
    }

    const R = byKey(rev), F = byKey(refunds), E = byKey(exp), P = byKey(pay), J = byKey(jobs);
    const monthly = months.map((m) => {
      const revenue = round2((R[m]?.total || 0) - (F[m]?.total || 0));
      const expenses = round2(E[m]?.total || 0);
      const staffPay = round2(P[m]?.total || 0);
      return { month: m, revenue, refunds: round2(F[m]?.total || 0), expenses, staffPay, profit: round2(revenue - expenses - staffPay), payments: R[m]?.n || 0, jobs: J[m]?.n || 0 };
    });
    const D = byKey(daily);
    const days = Array.from({ length: 30 }, (_, i) => { const d = addDays(dayFrom, i); return { date: d, revenue: round2(D[d]?.total || 0) }; });

    const cur = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const sum = (k) => round2(monthly.reduce((s, m) => s + m[k], 0));
    const O = byKey(outstanding);
    res.json({
      months: n, monthly, days,
      totals: { revenue: sum("revenue"), expenses: sum("expenses"), staffPay: sum("staffPay"), profit: sum("profit"), jobs: sum("jobs") },
      thisMonth: { ...cur, growth: prev?.revenue ? round2(((cur.revenue - prev.revenue) / prev.revenue) * 100) : null, lastMonthRevenue: prev?.revenue || 0, monthEnd: monthEnd(cur.month) },
      averageJob: payments.length ? round2(payments.reduce((s, p) => s + (p.amount || 0), 0) / payments.length) : 0,
      bySource: Object.entries(bySource).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      byService: services.map((s) => ({ name: s._id || "Other", total: round2(s.total), count: s.n })),
      byArea: areas.map((s) => ({ name: s._id || "Unknown", total: round2(s.total), count: s.n })),
      plans: { monthly: round2(mrr[0]?.total || 0), count: mrr[0]?.n || 0 },
      outstanding: { due: round2(O.due?.total || 0), dueCount: O.due?.n || 0, overdue: round2(O.overdue?.total || 0), overdueCount: O.overdue?.n || 0 },
      customers: { total: customers, newThisMonth: newCustomers, repeatRate: repeat[0]?.customers ? Math.round((repeat[0].repeat / repeat[0].customers) * 100) : 0 },
    });
  });

  // Cleaner performance for a month: jobs, value, ratings, punctuality, complaints.
  router.get("/cleaners", async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : lagosDate().slice(0, 7);
    const range = { $gte: `${month}-01`, $lte: monthEnd(month) };
    const [workers, jobs, complaints] = await Promise.all([
      Worker.find().select("firstName lastName status areas lastActiveAt").lean(),
      Booking.find({ assignedWorker: { $ne: null }, "schedule.date": range, status: { $in: ["Assigned", "In Progress", "Completed"] } })
        .select("bookingId assignedWorker status schedule job cleanerRating payment.amount workerPay.amount").lean(),
      Record.find({ type: "complaint", createdAt: { $gte: lagosToInstant(`${month}-01`), $lt: lagosToInstant(addDays(monthEnd(month), 1)) } }).select("data.bookingRef").lean(),
    ]);
    const refs = complaints.map((c) => c.data?.bookingRef).filter(Boolean);
    const complained = refs.length ? await Booking.find({ bookingId: { $in: refs } }).select("assignedWorker").lean() : [];
    const complaintsBy = {};
    for (const b of complained) if (b.assignedWorker) complaintsBy[b.assignedWorker] = (complaintsBy[b.assignedWorker] || 0) + 1;

    const rows = workers.map((w) => {
      const mine = jobs.filter((j) => String(j.assignedWorker) === String(w._id));
      const done = mine.filter((j) => j.status === "Completed");
      const rated = done.filter((j) => j.cleanerRating?.stars);
      const started = done.filter((j) => j.job?.startedAt && j.schedule?.time);
      const onTime = started.filter((j) => new Date(j.job.startedAt) <= new Date(lagosToInstant(j.schedule.date, j.schedule.time).getTime() + 15 * 60 * 1000));
      const timed = done.filter((j) => j.job?.startedAt && j.job?.finishedAt);
      return {
        id: w._id, name: `${w.firstName} ${w.lastName || ""}`.trim(), status: w.status, areas: w.areas, lastActiveAt: w.lastActiveAt,
        assigned: mine.length, completed: done.length,
        value: round2(done.reduce((s, j) => s + (j.payment?.amount || 0), 0)),
        earned: round2(done.reduce((s, j) => s + (j.workerPay?.amount || 0), 0)),
        rating: rated.length ? round2(rated.reduce((s, j) => s + j.cleanerRating.stars, 0) / rated.length) : null,
        ratings: rated.length,
        onTimeRate: started.length ? Math.round((onTime.length / started.length) * 100) : null,
        avgHours: timed.length ? round2(timed.reduce((s, j) => s + (new Date(j.job.finishedAt) - new Date(j.job.startedAt)), 0) / timed.length / 3600000) : null,
        complaints: complaintsBy[w._id] || 0,
      };
    }).sort((a, b) => b.completed - a.completed || (b.rating || 0) - (a.rating || 0));
    res.json({ month, cleaners: rows });
  });

  return router;
};
