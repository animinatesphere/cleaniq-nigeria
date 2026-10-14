const mongoose = require("mongoose");

// Every Paystack transaction we've seen (admin → Payments).
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingId: String,
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" }, // monthly plan payments
    amount: Number, // ₦
    currency: { type: String, default: "NGN" },
    status: { type: String, enum: ["success", "failed", "refunded", "mismatch"], required: true },
    channel: String,
    paidAt: Date,
    email: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
