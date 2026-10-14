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
    // Weekly availability, e.g. [{ day: 1, from: "08:00", to: "17:00" }] (day 0 = Sunday)
    availability: [{ _id: false, day: { type: Number, min: 0, max: 6 }, from: String, to: String }],
    notes: { type: String, default: "" },
    mustChangePassword: { type: Boolean, default: false },
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
