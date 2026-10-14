// Admin → Automations, SMS automation and AI receptionist settings.
const express = require("express");
const Record = require("../../models/Record");
const Lead = require("../../models/Lead");
const SupportThread = require("../../models/SupportThread");
const { AUTOMATIONS, SMS, getAutomations, getSmsSettings, getAiSettings, fill } = require("../../lib/automations");
const { setSetting } = require("../../lib/settings");
const { logAdmin } = require("../../lib/audit");
const { clean, normaliseNgPhone } = require("../../lib/text");
const { badRequest } = require("../../middleware/errors");

module.exports = function adminAutomationRoutes({ auth, sms, config }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");

  router.get("/", async (req, res) => res.json({ automations: await getAutomations() }));
  router.put("/", managers, async (req, res) => {
    const next = Object.fromEntries(Object.keys(AUTOMATIONS).map((k) => [k, req.body?.[k] === undefined ? undefined : Boolean(req.body[k])]).filter(([, v]) => v !== undefined));
    const automations = { ...(await getAutomations()), ...next };
    await setSetting("automations", automations);
    await logAdmin(req, "automations.update", "automations", next);
    res.json({ automations });
  });

  router.get("/sms", async (req, res) => res.json({ sms: await getSmsSettings(), connected: Boolean(config.termiiApiKey) }));
  router.put("/sms", managers, async (req, res) => {
    const b = req.body || {};
    const cur = await getSmsSettings();
    const templates = { ...cur.templates };
    for (const k of Object.keys(SMS.templates)) {
      if (b.templates?.[k] !== undefined) {
        const t = clean(b.templates[k], 480);
        if (!t) throw badRequest("A message can't be empty", { [k]: "Write the message" });
        templates[k] = t;
      }
    }
    const value = { ...cur, templates };
    for (const k of ["enabled", "dayBeforeReminder", "invoiceIssued"]) if (b[k] !== undefined) value[k] = Boolean(b[k]);
    await setSetting("smsAutomation", value);
    await logAdmin(req, "sms.update", "sms", { enabled: value.enabled });
    res.json({ sms: value, connected: Boolean(config.termiiApiKey) });
  });
  router.post("/sms/test", managers, async (req, res) => {
    const to = normaliseNgPhone(req.body?.phone);
    if (!to) throw badRequest("Enter a Nigerian phone number", { phone: "Enter a Nigerian phone number" });
    const s = await getSmsSettings();
    const key = req.body?.template === "invoice" ? "invoice" : "reminder";
    const text = fill(s.templates[key], { firstName: "Ada", date: "Friday 9 October", time: "10:00am", ref: "NG-123456", amount: "₦45,000", link: `${config.frontendUrl}/pay` });
    const r = await sms.send(to, text);
    res.json({ result: r.status, text });
  });

  router.get("/ai", async (req, res) => {
    const [ai, knowledge, leads, chats] = await Promise.all([
      getAiSettings(),
      Record.countDocuments({ type: "knowledge" }),
      Lead.countDocuments({ source: { $in: ["whatsapp", "phone"] } }),
      SupportThread.countDocuments({ channel: { $in: ["whatsapp", "phone"] } }),
    ]);
    res.json({ ai, stats: { knowledge, leads, chats }, ready: { claude: Boolean(config.anthropicApiKey), whatsapp: false, phone: false } });
  });
  router.put("/ai", managers, async (req, res) => {
    const b = req.body || {};
    const cur = await getAiSettings();
    const names = b.names === undefined ? cur.names : (Array.isArray(b.names) ? b.names : String(b.names).split(",")).map((n) => clean(n, 30)).filter(Boolean).slice(0, 10);
    if (!names.length) throw badRequest("Give the receptionist at least one name", { names: "Add a name" });
    const handoverPhone = b.handoverPhone === undefined ? cur.handoverPhone : b.handoverPhone ? normaliseNgPhone(b.handoverPhone) : "";
    if (b.handoverPhone && !handoverPhone) throw badRequest("Enter a Nigerian phone number", { handoverPhone: "Enter a Nigerian phone number" });
    const ai = {
      ...cur, names, handoverPhone,
      enabled: b.enabled === undefined ? cur.enabled : Boolean(b.enabled),
      saveLeads: b.saveLeads === undefined ? cur.saveLeads : Boolean(b.saveLeads),
      greeting: b.greeting === undefined ? cur.greeting : clean(b.greeting, 400) || cur.greeting,
      instructions: b.instructions === undefined ? cur.instructions : String(b.instructions || "").slice(0, 6000),
      channels: { whatsapp: Boolean(b.channels?.whatsapp ?? cur.channels.whatsapp), phone: Boolean(b.channels?.phone ?? cur.channels.phone) },
    };
    await setSetting("aiReceptionist", ai);
    await logAdmin(req, "ai.update", "ai", { enabled: ai.enabled });
    res.json({ ai });
  });

  return router;
};
