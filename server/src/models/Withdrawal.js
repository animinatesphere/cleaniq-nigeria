const mongoose = require("mongoose");

// A payout to a cleaner (Paystack Transfer to their Nigerian bank account).
const withdrawalSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    workerName: String,
    amount: { type: Number, required: true, min: 0 }, // ₦
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
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
