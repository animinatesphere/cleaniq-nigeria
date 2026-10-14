const mongoose = require("mongoose");

// Cleaner job applications from the website.
const applicantSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    area: String,
    experience: String,
    availability: String,
    message: String,
    status: { type: String, enum: ["new", "accepted", "rejected"], default: "new" },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
    reviewedBy: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Applicant", applicantSchema);
