// Public: cleaner job applications from the website.
const express = require("express");
const Applicant = require("../models/Applicant");
const { clean, normaliseEmail, isEmail, normaliseNgPhone, escapeHtml } = require("../lib/text");
const { staffEmails } = require("../lib/staffEmails");
const { badRequest } = require("../middleware/errors");

module.exports = function applicantRoutes({ limiters, mailer, config }) {
  const router = express.Router();
  const emails = staffEmails(config);

  router.post("/", limiters.publicForm, async (req, res) => {
    const b = req.body || {};
    const errors = {};
    const data = {
      firstName: clean(b.firstName, 50), lastName: clean(b.lastName, 50), email: normaliseEmail(b.email), phone: normaliseNgPhone(b.phone),
      area: clean(b.area, 60), experience: clean(b.experience, 500), availability: clean(b.availability, 300), message: clean(b.message, 1000),
    };
    if (data.firstName.length < 2) errors.firstName = "Please enter your first name";
    if (!isEmail(data.email)) errors.email = "Please enter a valid email address";
    if (!data.phone) errors.phone = "Please enter a Nigerian mobile number";
    if (!data.area) errors.area = "Please tell us where in Lagos you live";
    if (b.consent !== true) errors.consent = "Please agree so we can contact you about your application";
    if (Object.keys(errors).length) throw badRequest("Please check your application", errors);
    if (await Applicant.exists({ email: data.email, status: "new" })) return res.status(201).json({ ok: true });
    const a = await Applicant.create(data);
    await mailer.send({ to: a.email, ...emails.applicationReceived(a) });
    if (config.teamEmail) await mailer.send({ to: config.teamEmail, subject: `New cleaner application: ${a.firstName} ${a.lastName}`, type: "team-applicant", html: `<p>New application from ${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)} (${escapeHtml(a.area)}). See admin → Applicants.</p>` });
    res.status(201).json({ ok: true });
  });

  return router;
};
