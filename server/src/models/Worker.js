const mongoose = require("mongoose");

// Cleaners. Created by admin; they log in to the worker app with email/phone + password.
const workerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true, select: false },
    areas: { type: [String], default: [] }, // Lagos areas they cover
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    bank: {
      bankName: String,
      bankCode: String,
      accountNumber: String,
      accountName: String,
      recipientCode: String, // Paystack transfer recipient
    },
    lastLoginAt: Date,
    lastActiveAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Worker", workerSchema);
