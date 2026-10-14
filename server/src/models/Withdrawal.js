const mongoose = require("mongoose");

// A payout to a cleaner (Paystack Transfer to their Nigerian bank account).
const withdrawalSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    workerName: String,
    amount: { type: Number, required: true, min: 0 }, // ₦
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    // Monthly payroll: one per cleaner per month (kind "payroll"); older per-job payouts are "payout".
    kind: { type: String, enum: ["payout", "payroll"], default: "payout" },
    month: { type: String, default: null }, // YYYY-MM (Lagos)
    // "<workerId>:<month>" while a payroll payment is waiting/sent/paid — unique, so a cleaner can't be
    // paid twice for the same month. Removed if the payment fails, so it can be tried again.
    payrollKey: { type: String, unique: true, sparse: true },
    breakdown: { salary: Number, jobsAmount: Number, jobsCount: Number, adjustments: Number },
    method: { type: String, default: "paystack" }, // paystack | cash | bank transfer
    note: String,
    status: { type: String, enum: ["Requested", "Processing", "Paid", "Rejected", "Failed"], default: "Requested", index: true },
    reference: { type: String, unique: true, sparse: true },
    transferCode: String,
    bank: { bankName: String, accountNumber: String, accountName: String },
    failureReason: String,
    requestedBy: String, // "worker" or admin name
    reviewedBy: String,
    paidAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
