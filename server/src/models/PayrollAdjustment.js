// A bonus (+) or deduction (−) on a cleaner's pay for one month (admin → Staff pay).
const mongoose = require("mongoose");

const payrollAdjustmentSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true }, // YYYY-MM (Lagos)
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    amount: { type: Number, required: true }, // ₦, negative = deduction
    note: { type: String, required: true, trim: true, maxlength: 200 },
    by: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayrollAdjustment", payrollAdjustmentSchema);
