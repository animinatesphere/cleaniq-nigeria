// Monthly payroll (Nigeria): every cleaner is paid once a month on payday.
//  - salary cleaners: their monthly salary
//  - per-job cleaners: the pay for jobs they finished that month (Lagos time)
//  plus bonuses / minus deductions added by admin. Paid by Paystack Transfer or marked paid (cash/transfer).
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const Withdrawal = require("../models/Withdrawal");
const PayrollAdjustment = require("../models/PayrollAdjustment");
const { lagosToInstant } = require("./time");
const { round2 } = require("./money");

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isMonth = (m) => MONTH_RE.test(String(m || ""));
const thisMonth = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 7); // Lagos = UTC+1

function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: lagosToInstant(`${month}-01`), to: lagosToInstant(`${next}-01`) };
}

/** Pay for every cleaner for a month: [{ workerId, name, payType, salary, jobsCount, jobsAmount, adjustments[], adjustmentsTotal, total, bank, payment }] */
async function payrollFor(month) {
  const { from, to } = monthRange(month);
  const [workers, jobs, adjustments, payments] = await Promise.all([
    Worker.find().select("firstName lastName status pay bank.bankName bank.accountNumber bank.bankCode").lean(),
    Booking.find({ status: "Completed", assignedWorker: { $ne: null }, "job.finishedAt": { $gte: from, $lt: to } })
      .select("bookingId assignedWorker workerPay job.finishedAt service").lean(),
    PayrollAdjustment.find({ month }).sort({ createdAt: 1 }).lean(),
    Withdrawal.find({ kind: "payroll", month }).sort({ createdAt: -1 }).lean(),
  ]);
  const jobsBy = new Map();
  for (const j of jobs) {
    const k = String(j.assignedWorker);
    if (!jobsBy.has(k)) jobsBy.set(k, []);
    jobsBy.get(k).push(j);
  }
  return workers
    .map((w) => {
      const id = String(w._id);
      const myJobs = jobsBy.get(id) || [];
      const myAdj = adjustments.filter((a) => String(a.worker) === id);
      const payType = w.pay?.type === "salary" ? "salary" : "perJob";
      const salary = payType === "salary" ? round2(w.pay?.monthlySalary || 0) : 0;
      const jobsAmount = round2(myJobs.reduce((s, j) => s + (j.workerPay?.amount || 0), 0));
      const adjustmentsTotal = round2(myAdj.reduce((s, a) => s + a.amount, 0));
      const payment = payments.find((p) => String(p.worker) === id && p.payrollKey) || payments.find((p) => String(p.worker) === id) || null;
      return {
        workerId: id,
        name: `${w.firstName} ${w.lastName || ""}`.trim(),
        status: w.status,
        payType,
        salary,
        jobsCount: myJobs.length,
        jobsAmount,
        jobs: myJobs.map((j) => ({ bookingId: j.bookingId, service: j.service, finishedAt: j.job?.finishedAt, amount: j.workerPay?.amount || 0 })),
        adjustments: myAdj.map((a) => ({ _id: a._id, amount: a.amount, note: a.note, by: a.by, at: a.createdAt })),
        adjustmentsTotal,
        total: round2(Math.max(0, salary + jobsAmount + adjustmentsTotal)),
        hasBank: Boolean(w.bank?.accountNumber && w.bank?.bankCode),
        bank: w.bank?.accountNumber ? `${w.bank.bankName || "Bank"} ••${String(w.bank.accountNumber).slice(-4)}` : "",
        payment: payment && { _id: payment._id, status: payment.status, amount: payment.amount, method: payment.method, paidAt: payment.paidAt, failureReason: payment.failureReason, reference: payment.reference },
      };
    })
    // Show cleaners who are active or have something for this month.
    .filter((r) => r.status === "active" || r.total > 0 || r.payment)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

module.exports = { payrollFor, monthRange, isMonth, thisMonth };
