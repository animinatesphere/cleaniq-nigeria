// Admin list pages built on lib/recordTypes.js: /api/admin/c/:type (list, add, edit, delete, send).
const express = require("express");
const Record = require("../../models/Record");
const Customer = require("../../models/Customer");
const Worker = require("../../models/Worker");
const Lead = require("../../models/Lead");
const { TYPES, cleanRecord, publicTypes } = require("../../lib/recordTypes");
const { paging, escapeRegex } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { layout } = require("../../lib/email");
const { escapeHtml, isEmail, normaliseEmail } = require("../../lib/text");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");

const MAX_SEND = 500;

module.exports = function adminCollectionRoutes({ auth, mailer, config }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");

  const typeOf = (req) => {
    const def = TYPES[req.params.type];
    if (!def) throw notFound("Unknown page");
    return def;
  };
  const canWrite = (req, def) => {
    if (!def.write.includes(req.admin.role)) throw new HttpError(403, "You don't have permission to change this");
  };
  async function checkUnique(def, type, data, exceptId) {
    if (!def.unique || data[def.unique] === undefined) return;
    const clash = await Record.exists({ type, [`data.${def.unique}`]: data[def.unique], ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
    if (clash) throw badRequest("That's already used", { [def.unique]: "That's already used" });
  }

  router.get("/types", (req, res) => res.json({ types: publicTypes() }));

  router.get("/:type", async (req, res) => {
    const def = typeOf(req);
    const { page, limit, skip } = paging(req.query);
    const filter = { type: req.params.type };
    const term = String(req.query.q || "").trim().slice(0, 80);
    if (term) {
      const re = new RegExp(escapeRegex(term), "i");
      filter.$or = [{ title: re }, ...def.fields.filter((f) => ["text", "textarea", "email", "code"].includes(f.type)).map((f) => ({ [`data.${f.key}`]: re }))];
    }
    if (req.query.status && def.statuses?.includes(req.query.status)) filter.status = req.query.status;
    const [items, total, counts] = await Promise.all([
      Record.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Record.countDocuments(filter),
      def.statusField ? Record.aggregate([{ $match: { type: req.params.type } }, { $group: { _id: "$status", n: { $sum: 1 } } }]) : [],
    ]);
    res.json({ items, total, page, limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
  });

  router.post("/:type", async (req, res) => {
    const def = typeOf(req);
    canWrite(req, def);
    const { data, title, status, errors } = cleanRecord(req.params.type, req.body || {});
    if (Object.keys(errors).length) throw badRequest("Please check the details", errors);
    await checkUnique(def, req.params.type, data);
    const r = await Record.create({ type: req.params.type, data, title, status: status || "", createdBy: req.admin.name });
    await logAdmin(req, `${req.params.type}.create`, title);
    res.status(201).json({ item: r });
  });

  router.get("/:type/:id", async (req, res) => {
    typeOf(req);
    const r = await Record.findOne({ _id: req.params.id, type: req.params.type }).lean().catch(() => null);
    if (!r) throw notFound("Not found");
    res.json({ item: r });
  });

  router.patch("/:type/:id", async (req, res) => {
    const def = typeOf(req);
    canWrite(req, def);
    const r = await Record.findOne({ _id: req.params.id, type: req.params.type }).catch(() => null);
    if (!r) throw notFound("Not found");
    const { data, errors } = cleanRecord(req.params.type, req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the details", errors);
    await checkUnique(def, req.params.type, data, r._id);
    r.data = { ...r.data, ...data };
    const full = cleanRecord(req.params.type, r.data);
    r.title = full.title || r.title;
    if (def.statusField) r.status = String(r.data[def.statusField] ?? r.status);
    r.updatedBy = req.admin.name;
    r.markModified("data");
    await r.save();
    await logAdmin(req, `${req.params.type}.update`, r.title);
    res.json({ item: r });
  });

  router.delete("/:type/:id", async (req, res) => {
    const def = typeOf(req);
    canWrite(req, def);
    const r = await Record.findOne({ _id: req.params.id, type: req.params.type }).catch(() => null);
    if (!r) throw notFound("Not found");
    await moveToBin(r, { label: `${def.singular}: ${r.title}`, deletedBy: req.admin.name });
    await logAdmin(req, `${req.params.type}.delete`, r.title);
    res.json({ ok: true });
  });

  // ── Send (campaigns, cold emails, guides) ──────────────────────────────────────────────
  async function recipients(type, d) {
    const list = (arr) => [...new Set((arr || []).map(normaliseEmail).filter(isEmail))];
    if (type === "coldEmail" || d.audience === "These emails") return list(d.emails);
    if (d.audience === "All customers") return list((await Customer.find().select("email").lean()).map((c) => c.email));
    if (d.audience === "All cleaners") return list((await Worker.find({ status: "active" }).select("email").lean()).map((w) => w.email));
    const stage = { "All leads": null, "New leads": "new", "Quoted leads": "quoted", "Lost leads": "lost" }[d.audience];
    if (stage !== undefined) return list((await Lead.find(stage ? { stage } : {}).select("email").lean()).map((l) => l.email));
    return [];
  }
  const paragraphs = (text) => String(text || "").split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

  // How many people it would go to (shown before sending).
  router.get("/:type/:id/recipients", managers, async (req, res) => {
    const def = typeOf(req);
    if (!def.send) throw badRequest("This can't be sent");
    const r = await Record.findOne({ _id: req.params.id, type: req.params.type }).lean().catch(() => null);
    if (!r) throw notFound("Not found");
    const to = await recipients(req.params.type, r.data);
    res.json({ count: to.length, sample: to.slice(0, 5), max: MAX_SEND });
  });

  router.post("/:type/:id/send", managers, async (req, res) => {
    const def = typeOf(req);
    if (!def.send) throw badRequest("This can't be sent");
    const r = await Record.findOne({ _id: req.params.id, type: req.params.type }).catch(() => null);
    if (!r) throw notFound("Not found");
    if (r.sent?.at && req.body?.again !== true) throw badRequest("This was already sent. Send it again?");
    const to = await recipients(req.params.type, r.data);
    if (!to.length) throw badRequest("Nobody to send it to — check who it's for");
    if (to.length > MAX_SEND) throw badRequest(`That's ${to.length} people — the most in one go is ${MAX_SEND}. Split the list.`);
    const d = r.data;
    const html = def.send === "guide"
      ? layout(config, { title: d.title, intro: paragraphs(d.message || "Here's a guide we think you'll find useful."), button: { url: d.link, label: "Open the guide" } })
      : layout(config, { title: d.subject, bodyHtml: paragraphs(d.body), button: d.buttonLink ? { url: d.buttonLink, label: d.buttonText || "Find out more" } : undefined });
    const subject = def.send === "guide" ? d.title : d.subject;
    let sent = 0;
    for (const email of to) {
      const out = await mailer.send({ to: email, subject, html, type: def.send, ref: String(r._id) });
      if (out.status !== "failed") sent++;
    }
    r.sent = { at: new Date(), count: sent, by: req.admin.name };
    if (def.statusField) {
      r.data = { ...r.data, status: "Sent" };
      r.status = "Sent";
      r.markModified("data");
    }
    await r.save();
    await logAdmin(req, `${req.params.type}.send`, r.title, { sent, of: to.length });
    res.json({ sent, of: to.length, item: r });
  });

  return router;
};
