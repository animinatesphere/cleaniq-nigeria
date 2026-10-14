const mongoose = require("mongoose");

// A monthly cleaning plan, e.g. "2 cleans a week" for a fixed monthly price, paid monthly in advance.
// (The Subscriptions admin page and automatic Paystack charging come in a later step.)
const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerName: String,
    ref: { type: String, unique: true, sparse: true }, // e.g. PLAN-123456
    customerEmail: { type: String, lowercase: true, trim: true },
    customerPhone: String,
    area: String,
    address: String,
    service: String,
    plan: { cleans: Number, per: { type: String, enum: ["week", "month"] } }, // 2 per week
    monthlyPrice: { type: Number, required: true, min: 0 }, // ₦
    status: { type: String, enum: ["active", "paused", "payment_due", "cancelled"], default: "active", index: true },
    billingDay: { type: Number, min: 1, max: 28 },
    nextBillingDate: String, // YYYY-MM-DD
    startedAt: { type: Date, default: Date.now },
    cancelledAt: Date,
    regularWorker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
    authorizationCode: { type: String, select: false }, // Paystack saved card
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
