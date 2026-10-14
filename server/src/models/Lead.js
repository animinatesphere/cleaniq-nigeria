const mongoose = require("mongoose");

// Every enquiry / quote request / booking contact, for follow-up (admin → Leads).
const leadSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: String,
    area: String,
    source: { type: String, default: "website" }, // booking | quote | contact | whatsapp
    stage: { type: String, enum: ["new", "contacted", "quoted", "won", "lost"], default: "new" },
    notes: [{ _id: false, text: String, by: String, at: { type: Date, default: Date.now } }],
    followUpDate: String, // YYYY-MM-DD
    value: Number, // ₦ estimated
    message: String,
    ref: String, // booking / quote reference
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lead", leadSchema);
