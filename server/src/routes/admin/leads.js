// Admin → Leads and Pipeline: every enquiry, quote request and booking contact, moved through stages.
const express = require("express");
const Lead = require("../../models/Lead");
const { paging, searchFilter } = require("../../lib/query");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { clean, isEmail, normaliseEmail } = require("../../lib/text");
const { isValidDate } = require("../../lib/time");
const { round2 } = require("../../lib/money");
const { badRequest, notFound } = require("../../middleware/errors");

const STAGES = ["new", "contacted", "quoted", "won", "lost"];
const SOURCES = ["website", "booking", "quote", "contact", "whatsapp", "phone", "instagram", "referral", "admin", "other"];

function readLead(body, { partial } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has("name")) { out.name = clean(body.name, 80); if (!out.name) errors.name = "Enter a name"; }
  if (has("email")) { out.email = body.email ? normaliseEmail(body.email) : ""; if (out.email && !isEmail(out.email)) errors.email = "Enter a valid email"; }
  if (body.phone !== undefined) out.phone = clean(body.phone, 30);
  if (body.area !== undefined) out.area = clean(body.area, 60);
  if (body.message !== undefined) out.message = clean(body.message, 2000);
  if (body.source !== undefined) out.source = SOURCES.includes(body.source) ? body.source : "other";
  if (body.stage !== undefined) { if (!STAGES.includes(body.stage)) errors.stage = "Choose a stage"; else out.stage = body.stage; }
  if (body.followUpDate !== undefined) { out.followUpDate = body.followUpDate || ""; if (out.followUpDate && !isValidDate(out.followUpDate)) errors.followUpDate = "Choose a valid date"; }
  if (body.value !== undefined) out.value = body.value === "" || body.value === null ? null : round2(Math.max(0, Number(body.value) || 0));
  if (!partial && !out.email && !out.phone) errors.email = "Add an email or phone number";
  return { out, errors };
}

module.exports = function adminLeadRoutes({ auth }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");

  const load = async (id) => {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound("Lead not found");
    const doc = await Lead.findById(id);
    if (!doc) throw notFound("Lead not found");
    return doc;
  };

  router.get("/", async (req, res) => {
    const board = req.query.board === "1"; // pipeline: everything (recent first), no paging
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["name", "email", "phone", "area", "ref", "message"]);
    if (STAGES.includes(req.query.stage)) filter.stage = req.query.stage;
    if (SOURCES.includes(req.query.source)) filter.source = req.query.source;
    const [items, total, sums] = await Promise.all([
      Lead.find(filter).sort({ updatedAt: -1 }).skip(board ? 0 : skip).limit(board ? 500 : limit).lean(),
      Lead.countDocuments(filter),
      Lead.aggregate([{ $group: { _id: "$stage", n: { $sum: 1 }, value: { $sum: { $ifNull: ["$value", 0] } } } }]),
    ]);
    res.json({ items, total, page, limit, stages: STAGES, sources: SOURCES, counts: Object.fromEntries(sums.map((s) => [s._id, { count: s.n, value: round2(s.value) }])) });
  });

  router.post("/", async (req, res) => {
    const { out, errors } = readLead(req.body || {});
    if (Object.keys(errors).length) throw badRequest("Please check the lead", errors);
    const lead = await Lead.create({ source: "admin", ...out, notes: req.body?.note ? [{ text: clean(req.body.note, 1000), by: req.admin.name }] : [] });
    await logAdmin(req, "lead.create", String(lead._id));
    res.status(201).json({ lead });
  });

  router.get("/:id", async (req, res) => res.json({ lead: await load(req.params.id) }));

  router.patch("/:id", async (req, res) => {
    const lead = await load(req.params.id);
    const { out, errors } = readLead(req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the lead", errors);
    const from = lead.stage;
    lead.set(out);
    if (out.stage && out.stage !== from) lead.notes.push({ text: `Moved from ${from} to ${out.stage}`, by: req.admin.name });
    await lead.save();
    await logAdmin(req, "lead.update", String(lead._id), Object.keys(out));
    res.json({ lead });
  });

  router.post("/:id/notes", async (req, res) => {
    const text = clean(req.body?.text, 1000);
    if (!text) throw badRequest("Write a note");
    const lead = await Lead.findByIdAndUpdate((await load(req.params.id))._id, { $push: { notes: { text, by: req.admin.name } } }, { new: true });
    res.json({ lead });
  });

  router.delete("/:id", managers, async (req, res) => {
    const lead = await load(req.params.id);
    await moveToBin(lead, { label: `Lead ${lead.name || lead.email}`, deletedBy: req.admin.name });
    await logAdmin(req, "lead.delete", String(lead._id));
    res.json({ ok: true });
  });

  return router;
};
