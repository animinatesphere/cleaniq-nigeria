const mongoose = require("mongoose");

// The price list. category "Base" = a main service, "Extras" = an add-on.
// type "hourly" = rate × hours; "flat" = fixed price per item (optionally with options, e.g. oven sizes).
const optionSchema = new mongoose.Schema({ label: { type: String, required: true }, rate: { type: Number, required: true, min: 0 } }, { _id: false });

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: ["Base", "Extras"], required: true },
    type: { type: String, enum: ["hourly", "flat"], required: true },
    rate: { type: Number, required: true, min: 0 }, // ₦ per hour (hourly) or per item (flat)
    // Hourly price for regular cleans; empty = not offered for that frequency.
    weeklyRate: { type: Number, default: null, min: 0 },
    fortnightlyRate: { type: Number, default: null, min: 0 },
    monthlyRate: { type: Number, default: null, min: 0 },
    minHours: { type: Number, default: 2, min: 1, max: 12 },
    unitLabel: { type: String, default: "" }, // flat items: "carpet", "load", "room"
    options: { type: [optionSchema], default: [] }, // flat items with variants (Single / Double / Range oven)
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    // Cleaner pay (admin → Price list / Staff pay)
    workerHourlyRate: { type: Number, default: 0, min: 0 },
    workerPaymentRate: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Service", serviceSchema);
