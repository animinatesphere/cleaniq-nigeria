const mongoose = require("mongoose");

const STATUSES = ["Pending", "Confirmed", "Assigned", "In Progress", "Completed", "Cancelled"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Not required"];

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
      duration: Number, // hours
      frequency: String, // once | weekly | fortnightly | monthly
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
      status: { type: String, enum: PAYMENT_STATUSES, default: "Pending" },
      method: String, // Paystack
      channel: String, // card, bank_transfer, ussd…
      reference: { type: String, index: true, sparse: true },
      authorizationUrl: String,
      paidAt: Date,
      problem: String, // e.g. amount mismatch — for admin to check
    },
    status: { type: String, enum: STATUSES, default: "Pending", index: true },
    assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", default: null },
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
