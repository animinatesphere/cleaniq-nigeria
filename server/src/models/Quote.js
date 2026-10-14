const mongoose = require("mongoose");

const STATUSES = ["Sent", "Accepted", "Declined", "Expired"];

const itemSchema = new mongoose.Schema(
  {
    service: String, // name
    serviceSlug: String,
    billingType: { type: String, enum: ["hourly", "flat"] },
    qty: Number, // hours (hourly) or count (flat)
    unitPrice: Number,
    option: String, // e.g. "Double oven"
    extras: [{ _id: false, slug: String, name: String, qty: Number, unitPrice: Number }],
    subtotal: Number,
  },
  { _id: false },
);

const quoteSchema = new mongoose.Schema(
  {
    quoteRef: { type: String, required: true, unique: true }, // Q-NG-123456
    token: { type: String, required: true, select: false }, // secret in the customer's link
    customer: { firstName: String, lastName: String, email: { type: String, lowercase: true, trim: true, index: true }, phone: String },
    details: {
      area: String, address: String, landmark: String, propertyType: String,
      rooms: { bedrooms: Number, bathrooms: Number, kitchens: Number, livingRooms: Number, stairs: Number },
      pets: Boolean, supplies: String, frequency: String, notes: String,
    },
    items: [itemSchema],
    subtotal: Number,
    discount: { label: String, amount: { type: Number, default: 0 } },
    vat: { enabled: Boolean, rate: Number, label: String, amount: Number },
    grandTotal: Number,
    status: { type: String, enum: STATUSES, default: "Sent", index: true },
    validUntil: Date,
    serviceDate: String, // YYYY-MM-DD (preferred / agreed)
    serviceTime: String, // HH:MM
    acceptedAt: Date,
    declinedAt: Date,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingId: String,
    source: { type: String, default: "admin" }, // admin | website
    createdBy: String,
    sentCount: { type: Number, default: 0 },
    lastSentAt: Date,
    followUpsStopped: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Quote", quoteSchema);
module.exports.STATUSES = STATUSES;
