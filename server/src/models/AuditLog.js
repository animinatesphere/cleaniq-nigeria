const mongoose = require("mongoose");

// Who changed what in the admin.
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    adminName: String,
    action: { type: String, required: true }, // e.g. booking.status
    target: String, // e.g. NG-123456
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
