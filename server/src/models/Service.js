const mongoose = require("mongoose");

// The price list. Nigeria charges per clean, never per hour.
// Main services (category "Base"):
//   pricing "size"  — price per visit from a table of property type × bedrooms (+ extra bathrooms)
//   pricing "fixed" — fixed price per item (carpets, ovens — optionally with options like Double oven)
//   pricing "quote" — priced per job after a look (post-construction, offices, big jobs)
// Add-ons (category "Extras"): fixed price per unit (per load, per fridge, per room…).
const optionSchema = new mongoose.Schema({ label: { type: String, required: true }, rate: { type: Number, required: true, min: 0 } }, { _id: false });
const sizePriceSchema = new mongoose.Schema(
  {
    propertyType: { type: String, required: true },
    bedrooms: { type: Number, required: true, min: 0, max: 6 }, // 0 = self-contain, 6 = 6+
    price: { type: Number, required: true, min: 0 }, // ₦ per clean
    estHours: { type: Number, default: null, min: 0 }, // for scheduling cleaners only — never in the price
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: ["Base", "Extras"], required: true },
    pricing: { type: String, enum: ["size", "fixed", "quote"], default: "fixed" },
    sizePrices: { type: [sizePriceSchema], default: [] },
    extraBathroomPrice: { type: Number, default: 0, min: 0 }, // each bathroom beyond the number of bedrooms
    rate: { type: Number, default: 0, min: 0 }, // fixed / add-on price per unit
    unitLabel: { type: String, default: "" }, // "carpet", "load", "room"
    options: { type: [optionSchema], default: [] },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Service", serviceSchema);
