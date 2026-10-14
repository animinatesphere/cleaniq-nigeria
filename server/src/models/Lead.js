const mongoose = require("mongoose");

// Every enquiry / quote request / booking contact, for follow-up (admin → Leads).
const leadSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: String,
    area: String,
    source: { type: String, default: "website" }, // booking | quote | contact | whatsapp
    stage: { type: String, enum: ["new", "quoted", "won", "lost"], default: "new" },
    message: String,
    ref: String, // booking / quote reference
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lead", leadSchema);
