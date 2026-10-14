const mongoose = require("mongoose");

const STATUSES = ["Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refund pending", "Refunded", "Not required"];

const lineSchema = new mongoose.Schema({ key: String, label: String, qty: Number, unitPrice: Number, amount: Number }, { _id: false });

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true }, // NG-123456
    customer: {
      firstName: String,
      lastName: String,
      email: { type: String, lowercase: true, trim: true, index: true },
      phone: String,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    service: { type: String, required: true }, // service name at the time of booking
    serviceSlug: String,
    details: {
      area: String, // Lagos area
      address: String,
      landmark: String,
      size: String, // e.g. "3-bed Duplex" — what the price is based on
      estHours: Number, // estimated cleaning time, for scheduling only (never in the price)
      propertyType: String,
      rooms: { bedrooms: Number, bathrooms: Number, kitchens: Number, livingRooms: Number, stairs: Number },
      extras: [{ _id: false, slug: String, name: String, qty: Number, unitPrice: Number }],
      pets: Boolean,
      supplies: String, // cleaniq | customer
      parking: String,
      access: String,
      instructions: String,
    },
    schedule: {
      date: { type: String, index: true }, // YYYY-MM-DD, Lagos
      time: String, // HH:MM, Lagos
    },
    price: {
      lines: [lineSchema],
      subtotal: Number,
      vat: { enabled: Boolean, rate: Number, label: String, amount: Number },
      total: Number,
    },
    payment: {
      amount: Number, // ₦, what we charge
      currency: { type: String, default: "NGN" },
      // How this booking is paid: now (Paystack), after the clean, on the weekly bill, or by a monthly plan.
      plan: { type: String, enum: ["payNow", "payAfter", "weekly", "subscription"], default: "payNow" },
      dueDate: String, // YYYY-MM-DD (Lagos) when payment is due, for pay-after / weekly
      status: { type: String, enum: PAYMENT_STATUSES, default: "Pending" },
      method: String, // Paystack
      channel: String, // card, bank_transfer, ussd…
      reference: { type: String, index: true, sparse: true },
      authorizationUrl: String,
      paidAt: Date,
      problem: String, // e.g. amount mismatch — for admin to check
      offline: { method: String, note: String, by: String }, // paid outside Paystack (cash / bank transfer), recorded by admin
      refund: { amount: Number, status: String, providerId: String, requestedAt: Date, processedAt: Date, by: String, reason: String },
    },
    status: { type: String, enum: STATUSES, default: "Pending", index: true },
    assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", default: null },
    assignedWorkerName: { type: String, default: "" },
    // Job board for cleaners: hidden = no cleaner sees it; visibleTo = only these cleaners (empty = all).
    job: {
      hidden: { type: Boolean, default: false },
      visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Worker" }],
      acceptedAt: Date,
      startedAt: Date,
      finishedAt: Date,
    },
    // What the cleaner earns for this job (set when it's completed).
    workerPay: {
      amount: { type: Number, default: 0 },
      status: { type: String, enum: ["none", "unpaid", "processing", "paid"], default: "none" },
      withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: "Withdrawal" },
    },
    cancellation: { at: Date, by: String, reason: String },
    // The customer's rating of their cleaner after the clean (1–5 stars).
    cleanerRating: { stars: { type: Number, min: 1, max: 5 }, comment: String, ratedAt: Date },
    source: { type: String, default: "website" }, // website | admin | quote
    quoteRef: String,
    notes: [{ _id: false, text: String, by: String, at: { type: Date, default: Date.now } }],
    emails: { receivedAt: Date, confirmedAt: Date, reminderAt: Date, completedAt: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.STATUSES = STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
