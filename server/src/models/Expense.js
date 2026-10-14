const mongoose = require("mongoose");

// Business expenses (supplies, transport, rent, ads…). Used for profit in Analytics.
const expenseSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (Lagos)
    amount: { type: Number, required: true, min: 0 }, // ₦
    category: { type: String, default: "Other" },
    note: String,
    createdBy: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
