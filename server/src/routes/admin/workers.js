// Admin → Staff (cleaners) and Applicants.
const express = require("express");
const Worker = require("../../models/Worker");
const Booking = require("../../models/Booking");
const Applicant = require("../../models/Applicant");
const { paging, searchFilter } = require("../../lib/query");
const { clean, normaliseEmail, isEmail, normaliseNgPhone } = require("../../lib/text");
const { temporaryPassword, hashPassword } = require("../../lib/passwords");
const { staffEmails } = require("../../lib/staffEmails");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { round2 } = require("../../lib/money");
const { isValidTime } = require("../../lib/time");
const { LAGOS_AREAS } = require("../../lib/lagos");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");

const FIELDS = "firstName lastName email phone areas availability status notes bank lastLoginAt lastActiveAt createdAt";

// Staff (non-managers) see only the last 4 digits of bank accounts.
function present(w, role) {
  const out = { ...w };
  delete out.passwordHash; // never leaves the server (a just-created document still has it)
  if (out.bank) {
    const bank = { ...out.bank };
    delete bank.recipientCode;
    if (role === "staff" && bank.accountNumber) bank.accountNumber = `******${String(bank.accountNumber).slice(-4)}`;
    out.bank = bank;
  }
  return out;
}

function workerInput(body, { partial = false } = {}) {
  const errors = {};
  const data = {};
  if (!partial || body.firstName !== undefined) {
    data.firstName = clean(body.firstName, 50);
    if (data.firstName.length < 2) errors.firstName = "Enter a first name";
  }
  if (!partial || body.lastName !== undefined) data.lastName = clean(body.lastName, 50);
  if (!partial || body.email !== undefined) {
    data.email = normaliseEmail(body.email);
    if (!isEmail(data.email)) errors.email = "Enter a valid email";
  }
  if (!partial || body.phone !== undefined) {
    data.phone = body.phone ? normaliseNgPhone(body.phone) : "";
    if (body.phone && !data.phone) errors.phone = "Enter a Nigerian mobile number";
  }
  if (body.areas !== undefined) {
    if (!Array.isArray(body.areas) || body.areas.some((a) => !LAGOS_AREAS.includes(a))) errors.areas = "Choose areas from the list";
    else data.areas = [...new Set(body.areas)];
  }
  if (body.availability !== undefined) {
    const ok = Array.isArray(body.availability) && body.availability.every((a) => Number.isInteger(a?.day) && a.day >= 0 && a.day <= 6 && isValidTime(a.from) && isValidTime(a.to) && a.from < a.to);
    if (!ok) errors.availability = "Check the available days and times";
    else data.availability = body.availability.map(({ day, from, to }) => ({ day, from, to }));
  }
  if (body.notes !== undefined) data.notes = clean(body.notes, 2000);
  return { data, errors };
}

module.exports = function adminWorkerRoutes({ auth, mailer, config, paystack }) {
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const emails = staffEmails(config);

  async function createWorker(data) {
    if (await Worker.exists({ email: data.email })) throw new HttpError(409, "A cleaner with that email already exists");
    const password = temporaryPassword();
    const worker = await Worker.create({ ...data, passwordHash: await hashPassword(password), mustChangePassword: true });
    await mailer.send({ to: worker.email, ref: String(worker._id), ...emails.workerWelcome(worker, password) });
    return worker;
  }

  // ── Cleaners ──────────────────────────────────────────────────────────────────────────
  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["firstName", "lastName", "email", "phone"]);
    if (["active", "suspended"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total] = await Promise.all([Worker.find(filter).sort({ firstName: 1 }).skip(skip).limit(limit).select(FIELDS).lean(), Worker.countDocuments(filter)]);
    const stats = await Booking.aggregate([
      { $match: { assignedWorker: { $in: items.map((w) => w._id) } } },
      { $group: { _id: "$assignedWorker", completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } }, upcoming: { $sum: { $cond: [{ $in: ["$status", ["Assigned", "Confirmed", "In Progress"]] }, 1, 0] } }, unpaid: { $sum: { $cond: [{ $eq: ["$workerPay.status", "unpaid"] }, "$workerPay.amount", 0] } } } },
    ]);
    const byId = new Map(stats.map((s) => [String(s._id), s]));
    res.json({
      items: items.map((w) => ({ ...present(w, req.admin.role), completed: byId.get(String(w._id))?.completed || 0, upcoming: byId.get(String(w._id))?.upcoming || 0, unpaid: round2(byId.get(String(w._id))?.unpaid || 0) })),
      total, page, limit,
    });
  });

  router.get("/banks", managers, async (req, res) => {
    const banks = await paystack.listBanks();
    res.set("Cache-Control", "private, max-age=86400");
    res.json({ banks: banks.map((b) => ({ name: b.name, code: b.code })) });
  });

  router.get("/:id", async (req, res) => {
    const w = await Worker.findById(req.params.id).select(FIELDS).lean();
    if (!w) throw notFound("Cleaner not found");
    const jobs = await Booking.find({ assignedWorker: w._id }).sort({ "schedule.date": -1 }).limit(100).select("bookingId service schedule details.area status workerPay").lean();
    res.json({ worker: present(w, req.admin.role), jobs });
  });

  router.post("/", managers, async (req, res) => {
    const { data, errors } = workerInput(req.body || {});
    if (Object.keys(errors).length) throw badRequest("Please check the cleaner's details", errors);
    const worker = await createWorker(data);
    await logAdmin(req, "worker.create", worker.email);
    res.status(201).json({ worker: present(worker.toObject(), req.admin.role) });
  });

  router.patch("/:id", managers, async (req, res) => {
    const { data, errors } = workerInput(req.body || {}, { partial: true });
    if (Object.keys(errors).length) throw badRequest("Please check the cleaner's details", errors);
    if (data.email && (await Worker.exists({ email: data.email, _id: { $ne: req.params.id } }))) throw new HttpError(409, "Another cleaner uses that email");
    const w = await Worker.findByIdAndUpdate(req.params.id, { $set: data }, { new: true }).select(FIELDS).lean();
    if (!w) throw notFound("Cleaner not found");
    await logAdmin(req, "worker.update", w.email, { fields: Object.keys(data) });
    res.json({ worker: present(w, req.admin.role) });
  });

  // Bank details are checked with Paystack, which returns the real account name.
  router.patch("/:id/bank", managers, async (req, res) => {
    const accountNumber = String(req.body?.accountNumber || "").replace(/\D/g, "");
    const bankCode = String(req.body?.bankCode || "").trim();
    const bankName = clean(req.body?.bankName, 80);
    if (!/^\d{10}$/.test(accountNumber)) throw badRequest("Account number must be 10 digits", { accountNumber: "Account number must be 10 digits" });
    if (!bankCode) throw badRequest("Choose the bank", { bankCode: "Choose the bank" });
    const resolved = await paystack.resolveAccount({ accountNumber, bankCode });
    const w = await Worker.findByIdAndUpdate(
      req.params.id,
      { $set: { bank: { bankName, bankCode, accountNumber, accountName: resolved.account_name } } }, // new details → new Paystack recipient
      { new: true },
    ).select(FIELDS).lean();
    if (!w) throw notFound("Cleaner not found");
    await logAdmin(req, "worker.bank", w.email, { bankName, last4: accountNumber.slice(-4) });
    res.json({ worker: present(w, req.admin.role) });
  });

  router.post("/:id/status", managers, async (req, res) => {
    const status = req.body?.status;
    if (!["active", "suspended"].includes(status)) throw badRequest("Choose active or suspended");
    const w = await Worker.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).select(FIELDS).lean();
    if (!w) throw notFound("Cleaner not found");
    await logAdmin(req, `worker.${status === "active" ? "activate" : "suspend"}`, w.email);
    res.json({ worker: present(w, req.admin.role) });
  });

  router.post("/:id/reset-password", managers, async (req, res) => {
    const w = await Worker.findById(req.params.id);
    if (!w) throw notFound("Cleaner not found");
    const password = temporaryPassword();
    w.passwordHash = await hashPassword(password);
    w.mustChangePassword = true;
    await w.save();
    await mailer.send({ to: w.email, ref: String(w._id), ...emails.workerPasswordReset(w, password) });
    await logAdmin(req, "worker.reset-password", w.email);
    res.json({ ok: true });
  });

  router.delete("/:id", managers, async (req, res) => {
    const w = await Worker.findById(req.params.id);
    if (!w) throw notFound("Cleaner not found");
    if (await Booking.exists({ assignedWorker: w._id, status: { $in: ["Assigned", "In Progress"] } })) {
      throw badRequest("This cleaner has upcoming jobs — reassign them first");
    }
    await moveToBin(w, { label: `Cleaner ${w.firstName} ${w.lastName} <${w.email}>`, deletedBy: req.admin.name });
    await logAdmin(req, "worker.delete", w.email);
    res.json({ ok: true });
  });

  // ── Applicants ────────────────────────────────────────────────────────────────────────
  const applicants = express.Router();
  applicants.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["firstName", "lastName", "email", "phone", "area"]);
    if (["new", "accepted", "rejected"].includes(req.query.status)) filter.status = req.query.status;
    const [items, total] = await Promise.all([Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Applicant.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });

  applicants.post("/:id/accept", managers, async (req, res) => {
    const a = await Applicant.findOneAndUpdate({ _id: req.params.id, status: "new" }, { $set: { status: "accepted", reviewedBy: req.admin.name } }, { new: true });
    if (!a) throw badRequest("This application has already been reviewed");
    try {
      const worker = await createWorker(
        { firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone || "", areas: LAGOS_AREAS.includes(a.area) ? [a.area] : [] },
      );
      a.worker = worker._id;
      await a.save();
      await logAdmin(req, "applicant.accept", a.email);
      res.json({ applicant: a, worker: present(worker.toObject(), req.admin.role) });
    } catch (e) {
      await Applicant.updateOne({ _id: a._id }, { $set: { status: "new" } });
      throw e;
    }
  });

  applicants.post("/:id/reject", managers, async (req, res) => {
    const a = await Applicant.findOneAndUpdate({ _id: req.params.id, status: "new" }, { $set: { status: "rejected", reviewedBy: req.admin.name } }, { new: true });
    if (!a) throw badRequest("This application has already been reviewed");
    await logAdmin(req, "applicant.reject", a.email);
    res.json({ applicant: a });
  });

  return { workers: router, applicants };
};
