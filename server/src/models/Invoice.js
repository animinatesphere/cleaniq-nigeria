// A bill the customer pays by Paystack link (or offline): pay-after cleans, weekly bills, monthly plan
// payments, one-off payment links and manual invoices.
const mongoose = require("mongoose");

const lineSchema = new mongoose.Schema({ description: String, qty: Number, unitPrice: Number, amount: Number, bookingId: String }, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["payAfter", "weekly", "subscription", "link", "manual"], required: true, index: true },
    customer: { name: String, email: { type: String, lowercase: true, trim: true }, phone: String },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    lines: [lineSchema],
    subtotal: Number,
    vat: { enabled: Boolean, rate: Number, label: String, amount: Number },
    total: { type: Number, required: true, min: 0 },
    dueDate: String, // YYYY-MM-DD (Lagos)
    status: { type: String, enum: ["Unpaid", "Paid", "Cancelled"], default: "Unpaid", index: true },
    period: { from: String, to: String, month: String }, // weekly bill / monthly plan
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", index: true },
    paystack: { reference: { type: String, index: true, sparse: true }, url: String },
    paidAt: Date,
    method: String, // Paystack / cash / bank transfer
    note: String,
    sentAt: Date,
    reminders: { type: Number, default: 0 },
    lastReminderAt: Date,
    createdBy: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);
