// Logins: admin (email + password), customer (email code — signs up on first use), worker (email/phone + password).
const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const Worker = require("../models/Worker");
const { HttpError, badRequest } = require("../middleware/errors");
const { clean, normaliseEmail, isEmail, normaliseNgPhone } = require("../lib/text");
const { layout } = require("../lib/email");

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

module.exports = function authRoutes({ config, auth, limiters, mailer }) {
  const router = express.Router();
  const hashCode = (email, code) => crypto.createHmac("sha256", config.jwtSecret).update(`${email}:${code}`).digest("hex");
  const publicAdmin = (a) => ({ id: a._id, name: a.name, email: a.email, role: a.role, mustChangePassword: a.mustChangePassword });
  const publicCustomer = (c) => ({ id: c._id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone });

  // ── Admin ──────────────────────────────────────────────────────────────────────────────
  router.post("/admin/login", limiters.adminLogin, async (req, res) => {
    const email = normaliseEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const admin = email ? await Admin.findOne({ email }).select("+passwordHash") : null;
    const ok = admin && admin.active && (await bcrypt.compare(password, admin.passwordHash));
    if (!ok) throw new HttpError(401, "Wrong email or password");
    admin.lastLoginAt = new Date();
    await admin.save();
    res.json({ token: auth.signAdmin(admin), admin: publicAdmin(admin) });
  });

  router.get("/admin/me", auth.requireAdmin(), (req, res) => {
    res.json({ admin: publicAdmin(req.admin) });
  });

  router.post("/admin/change-password", auth.requireAdmin(), async (req, res) => {
    const { currentPassword = "", newPassword = "" } = req.body || {};
    if (String(newPassword).length < 10) throw badRequest("New password must be at least 10 characters");
    const admin = await Admin.findById(req.admin._id).select("+passwordHash");
    if (!(await bcrypt.compare(String(currentPassword), admin.passwordHash))) throw new HttpError(401, "Current password is wrong");
    admin.passwordHash = await bcrypt.hash(String(newPassword), 12);
    admin.mustChangePassword = false;
    await admin.save();
    res.json({ ok: true });
  });

  // ── Customer: email code ───────────────────────────────────────────────────────────────
  router.post("/customer/request-code", limiters.loginCode, async (req, res) => {
    const email = normaliseEmail(req.body?.email);
    if (!isEmail(email)) throw badRequest("Please enter a valid email address", { email: "Please enter a valid email address" });
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await Customer.updateOne(
      { email },
      {
        $setOnInsert: { email },
        $set: { "loginCode.hash": hashCode(email, code), "loginCode.expiresAt": new Date(Date.now() + CODE_TTL_MS), "loginCode.attempts": 0 },
      },
      { upsert: true },
    );
    await mailer.send({
      to: email,
      subject: `Your Cleaniq login code: ${code}`,
      type: "customer-login-code",
      html: layout(config, {
        title: "Your login code",
        intro: `Use this code to log in to Cleaniq. It expires in 10 minutes.`,
        bodyHtml: `<p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#036847;margin:16px 0">${code}</p><p style="font-size:13px;color:#64748b">If you didn't ask for this, you can ignore this email.</p>`,
      }),
    });
    res.json({ ok: true });
  });

  router.post("/customer/verify-code", limiters.login, async (req, res) => {
    const email = normaliseEmail(req.body?.email);
    const code = String(req.body?.code || "").replace(/\D/g, "");
    const customer = email ? await Customer.findOne({ email }).select("+loginCode.hash +loginCode.expiresAt +loginCode.attempts") : null;
    const lc = customer?.loginCode;
    if (!lc?.hash || !lc.expiresAt || lc.expiresAt < new Date() || lc.attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(401, "That code has expired. Please request a new one.");
    }
    const expected = Buffer.from(lc.hash, "hex");
    const given = Buffer.from(hashCode(email, code), "hex");
    if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
      await Customer.updateOne({ _id: customer._id }, { $inc: { "loginCode.attempts": 1 } });
      throw new HttpError(401, "That code isn't right. Please check and try again.");
    }
    // Optional profile details on first sign-up.
    const { firstName, lastName, phone } = req.body || {};
    if (firstName && !customer.firstName) customer.firstName = clean(firstName, 50);
    if (lastName && !customer.lastName) customer.lastName = clean(lastName, 50);
    if (phone && !customer.phone) customer.phone = normaliseNgPhone(phone) || "";
    customer.loginCode = { hash: undefined, expiresAt: undefined, attempts: 0 };
    customer.emailVerified = true;
    customer.lastLoginAt = new Date();
    await customer.save();
    res.json({ token: auth.signCustomer(customer), customer: publicCustomer(customer) });
  });

  router.get("/customer/me", auth.requireCustomer, (req, res) => {
    res.json({ customer: publicCustomer(req.customer) });
  });

  // ── Worker ─────────────────────────────────────────────────────────────────────────────
  router.post("/worker/login", limiters.login, async (req, res) => {
    const login = String(req.body?.login || req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const phone = normaliseNgPhone(login);
    const query = isEmail(normaliseEmail(login)) ? { email: normaliseEmail(login) } : phone ? { phone } : null;
    const worker = query ? await Worker.findOne(query).select("+passwordHash") : null;
    const ok = worker && worker.status === "active" && (await bcrypt.compare(password, worker.passwordHash));
    if (!ok) throw new HttpError(401, "Wrong login or password");
    worker.lastLoginAt = new Date();
    await worker.save();
    res.json({ token: auth.signWorker(worker), worker: { id: worker._id, firstName: worker.firstName, lastName: worker.lastName } });
  });

  return router;
};
