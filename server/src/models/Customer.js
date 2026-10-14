const mongoose = require("mongoose");

// Customers sign in with a one-time code sent to their email (no password to forget or leak).
const customerSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, maxlength: 50, default: "" },
    lastName: { type: String, trim: true, maxlength: 50, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" }, // +234XXXXXXXXXX
    area: { type: String, default: "" },
    address: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    loginCode: {
      hash: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false },
    },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Customer", customerSchema);
