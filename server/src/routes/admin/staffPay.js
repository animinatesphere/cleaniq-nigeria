// Admin → Staff pay (what each cleaner has earned) and withdrawals (Paystack Transfers).
const express = require("express");
const Booking = require("../../models/Booking");
const Worker = require("../../models/Worker");
const Withdrawal = require("../../models/Withdrawal");
const { startPayout } = require("../../lib/payouts");
const { logAdmin } = require("../../lib/audit");
const { paging } = require("../../lib/query");
const { round2 } = require("../../lib/money");
const { badRequest, notFound } = require("../../middleware/errors");

module.exports = function adminStaffPayRoutes({ auth, paystack }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const owner = auth.requireAdmin("owner");

  // Earnings per cleaner.
  router.get("/", managers, async (req, res) => {
    const rows = await Booking.aggregate([
      { $match: { assignedWorker: { $ne: null }, "workerPay.status": { $in: ["unpaid", "processing", "paid"] } } },
      {
        $group: {
          _id: "$assignedWorker",
          unpaid: { $sum: { $cond: [{ $eq: ["$workerPay.status", "unpaid"] }, "$workerPay.amount", 0] } },
          processing: { $sum: { $cond: [{ $eq: ["$workerPay.status", "processing"] }, "$workerPay.amount", 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$workerPay.status", "paid"] }, "$workerPay.amount", 0] } },
          unpaidJobs: { $sum: { $cond: [{ $eq: ["$workerPay.status", "unpaid"] }, 1, 0] } },
          jobs: { $sum: 1 },
        },
      },
    ]);
    const workers = await Worker.find({ _id: { $in: rows.map((r) => r._id) } }).select("firstName lastName bank.bankName bank.accountName bank.accountNumber status").lean();
    const byId = new Map(workers.map((w) => [String(w._id), w]));
    res.json({
      items: rows.map((r) => {
        const w = byId.get(String(r._id));
        return {
          workerId: r._id, name: w ? `${w.firstName} ${w.lastName}`.trim() : "Deleted cleaner", status: w?.status,
          hasBank: Boolean(w?.bank?.accountNumber), bank: w?.bank?.accountNumber ? `${w.bank.bankName} ••${String(w.bank.accountNumber).slice(-4)}` : "",
          unpaid: round2(r.unpaid), processing: round2(r.processing), paid: round2(r.paid), unpaidJobs: r.unpaidJobs, jobs: r.jobs,
        };
      }).sort((a, b) => b.unpaid - a.unpaid),
    });
  });

  router.get("/workers/:id/jobs", managers, async (req, res) => {
    const items = await Booking.find({ assignedWorker: req.params.id, "workerPay.status": { $ne: "none" } }).sort({ "schedule.date": -1 }).limit(200).select("bookingId service schedule workerPay status").lean();
    res.json({ items });
  });

  router.get("/withdrawals", managers, async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    const [items, total] = await Promise.all([Withdrawal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Withdrawal.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });

  // Creates a payout request for all of a cleaner's unpaid jobs (the worker app will create these too).
  router.post("/withdrawals", managers, async (req, res) => {
    const worker = await Worker.findById(req.body?.workerId);
    if (!worker) throw notFound("Cleaner not found");
    if (await Withdrawal.exists({ worker: worker._id, status: { $in: ["Requested", "Processing"] } })) throw badRequest("This cleaner already has a payout waiting");
    const jobs = await Booking.find({ assignedWorker: worker._id, "workerPay.status": "unpaid", "workerPay.withdrawal": null }).select("_id workerPay.amount").lean();
    const amount = round2(jobs.reduce((s, j) => s + (j.workerPay?.amount || 0), 0));
    if (!(amount > 0)) throw badRequest("Nothing to pay this cleaner yet");
    const w = await Withdrawal.create({ worker: worker._id, workerName: `${worker.firstName} ${worker.lastName}`.trim(), amount, bookings: jobs.map((j) => j._id), requestedBy: req.admin.name });
    // Tie the jobs to this payout so they aren't counted twice.
    await Booking.updateMany({ _id: { $in: w.bookings }, "workerPay.status": "unpaid" }, { $set: { "workerPay.withdrawal": w._id } });
    await logAdmin(req, "withdrawal.create", w.workerName, { amount });
    res.status(201).json({ withdrawal: w });
  });

  // Approve = send the money (Paystack Transfer). Owner only.
  router.post("/withdrawals/:id/pay", owner, async (req, res) => {
    const w = await startPayout(paystack, req.params.id, req.admin.name);
    await logAdmin(req, "withdrawal.pay", w.workerName, { amount: w.amount, reference: w.reference });
    res.json({ withdrawal: w });
  });

  router.post("/withdrawals/:id/reject", managers, async (req, res) => {
    const w = await Withdrawal.findOneAndUpdate({ _id: req.params.id, status: "Requested" }, { $set: { status: "Rejected", reviewedBy: req.admin.name } }, { new: true });
    if (!w) throw badRequest("Only waiting payouts can be rejected");
    await Booking.updateMany({ _id: { $in: w.bookings }, "workerPay.withdrawal": w._id }, { $unset: { "workerPay.withdrawal": "" } });
    await logAdmin(req, "withdrawal.reject", w.workerName, { amount: w.amount });
    res.json({ withdrawal: w });
  });

  return router;
};
