const AuditLog = require("../models/AuditLog");

// Records an admin action. Never blocks the request if logging fails.
async function logAdmin(req, action, target, details) {
  try {
    await AuditLog.create({ adminId: req.admin?._id, adminName: req.admin?.name, action, target, details });
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}

module.exports = { logAdmin };
