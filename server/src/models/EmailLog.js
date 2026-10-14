const mongoose = require("mongoose");

// Every email we try to send, for admin → Email history.
const emailLogSchema = new mongoose.Schema(
  {
    to: String,
    subject: String,
    type: String, // e.g. booking-received, booking-confirmed
    ref: String, // booking/quote reference
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
    providerId: String,
    error: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("EmailLog", emailLogSchema);
