const mongoose = require("mongoose");

// Staff who use the admin. Roles: owner (everything), manager (runs the business), staff (day-to-day).
const ROLES = ["owner", "manager", "staff"];

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "staff" },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Admin", adminSchema);
module.exports.ROLES = ROLES;
