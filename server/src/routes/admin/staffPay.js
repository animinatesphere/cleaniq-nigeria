// Admin → Staff pay (what each cleaner has earned) and withdrawals (Paystack Transfers).
const express = require("express");
const Booking = require("../../models/Booking");
const Worker = require("../../models/Worker");
const Withdrawal = require("../../models/Withdrawal");
const { startPayout } = require("../../lib/payouts");
const { logAdmin } = require("../../lib/audit");
const { paging } = require("../../lib/query");
const { round2 } = require("../../lib/money");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");
const PayrollAdjustment = require("../../models/PayrollAdjustment");
const { payrollFor, isMonth, thisMonth } = require("../../lib/payroll");
const { clean } = require("../../lib/text");

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

  // ── Monthly payroll (how Nigerian cleaners are paid) ─────────────────────────────────
  const monthParam = (m) => {
    if (!isMonth(m)) throw badRequest("Choose a month (YYYY-MM)");
    return m;
  };

  router.get("/payroll", managers, async (req, res) => {
    const month = req.query.month ? monthParam(req.query.month) : thisMonth();
    const items = await payrollFor(month);
    const sum = (k) => round2(items.reduce((s, r) => s + r[k], 0));
    res.json({
      month, items,
      totals: { total: sum("total"), paid: round2(items.filter((r) => r.payment?.status === "Paid").reduce((s, r) => s + r.payment.amount, 0)), cleaners: items.length, jobs: items.reduce((s, r) => s + r.jobsCount, 0) },
    });
  });

  async function notPaidYet(workerId, month) {
    if (await Withdrawal.exists({ payrollKey: `${workerId}:${month}` })) throw badRequest("This cleaner's pay for that month has already been sent — it can't be changed now");
  }

  router.post("/payroll/:month/adjustments", managers, async (req, res) => {
    const month = monthParam(req.params.month);
    const worker = await Worker.findById(req.body?.workerId).select("_id").lean();
    if (!worker) throw notFound("Cleaner not found");
    const amount = round2(Number(req.body?.amount));
    const note = clean(req.body?.note, 200);
    const errors = {};
    if (!amount || Math.abs(amount) > 10_000_000) errors.amount = "Enter the amount (use minus for a deduction)";
    if (note.length < 3) errors.note = "Say what it's for";
    if (Object.keys(errors).length) throw badRequest("Please check the bonus/deduction", errors);
    await notPaidYet(worker._id, month);
    const a = await PayrollAdjustment.create({ month, worker: worker._id, amount, note, by: req.admin.name });
    await logAdmin(req, "payroll.adjust", String(worker._id), { month, amount, note });
    res.status(201).json({ adjustment: a });
  });

  router.delete("/payroll/:month/adjustments/:id", managers, async (req, res) => {
    const month = monthParam(req.params.month);
    const a = await PayrollAdjustment.findOne({ _id: req.params.id, month });
    if (!a) throw notFound("Not found");
    await notPaidYet(a.worker, month);
    await a.deleteOne();
    await logAdmin(req, "payroll.adjust-remove", String(a.worker), { month, amount: a.amount });
    res.json({ ok: true });
  });

  // Pay one cleaner for the month: Paystack Transfer, or record cash / bank transfer. Owner only.
  router.post("/payroll/:month/pay", owner, async (req, res) => {
    const month = monthParam(req.params.month);
    const method = ["paystack", "cash", "bank transfer"].includes(req.body?.method) ? req.body.method : "paystack";
    const row = (await payrollFor(month)).find((r) => r.workerId === String(req.body?.workerId));
    if (!row) throw notFound("Cleaner not found");
    if (!(row.total > 0)) throw badRequest("Nothing to pay this cleaner for that month");
    if (method === "paystack" && !row.hasBank) throw badRequest("This cleaner has no bank details yet — add them on their profile");

    if (await Withdrawal.exists({ payrollKey: `${row.workerId}:${month}` })) throw new HttpError(409, "This cleaner has already been paid for that month");
    const jobIds = (await Booking.find({ bookingId: { $in: row.jobs.map((j) => j.bookingId) } }).select("_id").lean()).map((b) => b._id);
    let w;
    try {
      w = await Withdrawal.create({
        worker: row.workerId, workerName: row.name, amount: row.total, bookings: jobIds, kind: "payroll", month,
        payrollKey: `${row.workerId}:${month}`, method, note: clean(req.body?.note, 200),
        breakdown: { salary: row.salary, jobsAmount: row.jobsAmount, jobsCount: row.jobsCount, adjustments: row.adjustmentsTotal },
        requestedBy: req.admin.name,
        ...(method === "paystack" ? {} : { status: "Paid", paidAt: new Date(), reviewedBy: req.admin.name }),
      });
    } catch (e) {
      if (e.code === 11000) throw new HttpError(409, "This cleaner has already been paid for that month");
      throw e;
    }
    if (method === "paystack") {
      try {
        w = await startPayout(paystack, w._id, req.admin.name);
      } catch (e) {
        // Didn't go out: free the month so it can be tried again.
        await Withdrawal.updateOne({ _id: w._id }, { $set: { status: "Failed", failureReason: e.provider || e.message }, $unset: { payrollKey: "" } });
        throw e;
      }
    } else {
      await Booking.updateMany({ _id: { $in: jobIds } }, { $set: { "workerPay.status": "paid", "workerPay.withdrawal": w._id } });
    }
    await logAdmin(req, "payroll.pay", row.name, { month, amount: row.total, method });
    res.status(201).json({ payment: w });
  });

  return router;
};
