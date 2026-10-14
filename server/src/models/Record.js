// One row on a simple admin list page (task, complaint, contract, coupon …). The fields for each type
// are described and checked in lib/recordTypes.js.
const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    title: { type: String, default: "" }, // for search and lists
    status: { type: String, default: "" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: String,
    updatedBy: String,
    sent: { at: Date, count: Number, by: String }, // campaigns / guides / cold emails
  },
  { timestamps: true, minimize: false },
);
recordSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("Record", recordSchema);
