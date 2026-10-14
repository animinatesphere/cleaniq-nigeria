// Admin → Email history, Bin and the audit log.
const express = require("express");
const EmailLog = require("../../models/EmailLog");
const TrashItem = require("../../models/TrashItem");
const AuditLog = require("../../models/AuditLog");
const { restoreFromBin } = require("../../lib/bin");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { notFound, HttpError } = require("../../middleware/errors");

module.exports = function adminRecordRoutes({ auth }) {
  const managers = auth.requireAdmin("owner", "manager");
  const owner = auth.requireAdmin("owner");

  const emails = express.Router();
  emails.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["to", "subject", "ref", "type"]);
    if (["sent", "failed", "skipped"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total] = await Promise.all([EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), EmailLog.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });

  const bin = express.Router();
  bin.get("/", managers, async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["label", "modelName", "deletedBy"]);
    const [items, total] = await Promise.all([
      TrashItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("modelName label deletedBy createdAt").lean(),
      TrashItem.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  });
  bin.post("/:id/restore", managers, async (req, res) => {
    let doc;
    try {
      doc = await restoreFromBin(req.params.id);
    } catch (e) {
      if (e.code === 11000) throw new HttpError(409, "Something with the same details already exists, so this can't be restored");
      throw e;
    }
    if (!doc) throw notFound("Not in the Bin");
    await logAdmin(req, "bin.restore", String(doc._id), { model: doc.constructor.modelName });
    res.json({ ok: true });
  });
  bin.delete("/:id", owner, async (req, res) => {
    const item = await TrashItem.findByIdAndDelete(req.params.id);
    if (!item) throw notFound("Not in the Bin");
    await logAdmin(req, "bin.delete-forever", item.label);
    res.json({ ok: true });
  });

  const audit = express.Router();
  audit.get("/", owner, async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["action", "target", "adminName"]);
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });

  return { emails, bin, audit };
};
