// Admin → Settings: business details, VAT, supplies fee, email/SMS status, admin users & roles.
const express = require("express");
const Admin = require("../../models/Admin");
const { getSetting, setSetting, getPricingSettings, cleanVat } = require("../../lib/settings");
const { clean, normaliseEmail, isEmail, normaliseNgPhone } = require("../../lib/text");
const { temporaryPassword, hashPassword } = require("../../lib/passwords");
const { staffEmails } = require("../../lib/staffEmails");
const { logAdmin } = require("../../lib/audit");
const { round2 } = require("../../lib/money");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");
const { ROLES } = require("../../models/Admin");

const BUSINESS_DEFAULT = { name: "Cleaniq Nigeria", phone: "", whatsapp: "", email: "", address: "Lagos, Nigeria", smsSenderId: "Cleaniq" };

module.exports = function adminSettingsRoutes({ auth, config, mailer }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const owner = auth.requireAdmin("owner");
  const emails = staffEmails(config);

  router.get("/", async (req, res) => {
    const [business, pricing] = await Promise.all([getSetting("business"), getPricingSettings()]);
    res.json({
      business: { ...BUSINESS_DEFAULT, ...(business || {}) },
      vat: pricing.vat,
      suppliesFee: pricing.suppliesFee,
      // Keys live in server/.env — the admin only sees whether each is set.
      integrations: {
        paystack: Boolean(config.paystackSecretKey), email: Boolean(config.resendApiKey), emailFrom: config.emailFrom,
        sms: Boolean(config.termiiApiKey), ai: Boolean(config.anthropicApiKey), teamEmail: config.teamEmail,
      },
    });
  });

  router.put("/business", managers, async (req, res) => {
    const b = req.body || {};
    const errors = {};
    const value = {
      name: clean(b.name, 80) || BUSINESS_DEFAULT.name,
      phone: b.phone ? normaliseNgPhone(b.phone) : "",
      whatsapp: b.whatsapp ? normaliseNgPhone(b.whatsapp) : "",
      email: b.email ? normaliseEmail(b.email) : "",
      address: clean(b.address, 200),
      smsSenderId: clean(b.smsSenderId, 11).replace(/[^A-Za-z0-9 ]/g, "") || "Cleaniq",
    };
    if (b.phone && !value.phone) errors.phone = "Enter a Nigerian number";
    if (b.whatsapp && !value.whatsapp) errors.whatsapp = "Enter a Nigerian number";
    if (b.email && !isEmail(value.email)) errors.email = "Enter a valid email";
    if (Object.keys(errors).length) throw badRequest("Please check the details", errors);
    await setSetting("business", value);
    await logAdmin(req, "settings.business", "business", value);
    res.json({ business: value });
  });

  router.put("/pricing", managers, async (req, res) => {
    const b = req.body || {};
    const fee = Number(b.suppliesFee);
    if (!(fee >= 0 && fee <= 1_000_000)) throw badRequest("Enter the supplies fee in naira", { suppliesFee: "Enter the supplies fee in naira" });
    const rate = Number(b.vat?.rate);
    if (!(rate >= 0 && rate <= 100)) throw badRequest("VAT rate must be 0–100%", { vatRate: "VAT rate must be 0–100%" });
    const vat = cleanVat({ enabled: b.vat?.enabled, rate, label: b.vat?.label });
    await Promise.all([setSetting("vat", vat), setSetting("suppliesFee", round2(fee))]);
    await logAdmin(req, "settings.pricing", "pricing", { vat, suppliesFee: round2(fee) });
    res.json({ vat, suppliesFee: round2(fee) });
  });

  // ── Admin users & roles (owner only) ──────────────────────────────────────────────────
  router.get("/admins", owner, async (req, res) => {
    res.json({ items: await Admin.find().sort({ createdAt: 1 }).select("name email role active lastLoginAt createdAt mustChangePassword").lean() });
  });

  router.post("/admins", owner, async (req, res) => {
    const name = clean(req.body?.name, 100);
    const email = normaliseEmail(req.body?.email);
    const role = req.body?.role;
    const errors = {};
    if (name.length < 2) errors.name = "Enter a name";
    if (!isEmail(email)) errors.email = "Enter a valid email";
    if (!ROLES.includes(role)) errors.role = "Choose a role";
    if (Object.keys(errors).length) throw badRequest("Please check the details", errors);
    if (await Admin.exists({ email })) throw new HttpError(409, "That person already has an admin account");
    const password = temporaryPassword();
    const a = await Admin.create({ name, email, role, passwordHash: await hashPassword(password), mustChangePassword: true });
    await mailer.send({ to: email, ...emails.adminInvite(a, password) });
    await logAdmin(req, "admin.create", email, { role });
    res.status(201).json({ admin: { _id: a._id, name, email, role, active: true } });
  });

  async function otherActiveOwners(exceptId) {
    return Admin.countDocuments({ role: "owner", active: true, _id: { $ne: exceptId } });
  }

  router.patch("/admins/:id", owner, async (req, res) => {
    const a = await Admin.findById(req.params.id);
    if (!a) throw notFound("Admin not found");
    const { role, active } = req.body || {};
    if (role !== undefined && !ROLES.includes(role)) throw badRequest("Choose a role");
    const demotingOwner = a.role === "owner" && ((role && role !== "owner") || active === false);
    if (demotingOwner && (await otherActiveOwners(a._id)) === 0) throw badRequest("There must always be at least one active owner");
    if (role) a.role = role;
    if (active !== undefined) a.active = Boolean(active);
    await a.save();
    await logAdmin(req, "admin.update", a.email, { role: a.role, active: a.active });
    res.json({ admin: { _id: a._id, name: a.name, email: a.email, role: a.role, active: a.active } });
  });

  router.post("/admins/:id/reset-password", owner, async (req, res) => {
    const a = await Admin.findById(req.params.id);
    if (!a) throw notFound("Admin not found");
    const password = temporaryPassword();
    a.passwordHash = await hashPassword(password);
    a.mustChangePassword = true;
    await a.save();
    await mailer.send({ to: a.email, ...emails.adminPasswordReset(a, password) });
    await logAdmin(req, "admin.reset-password", a.email);
    res.json({ ok: true });
  });

  return router;
};
