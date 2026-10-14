// Admin → Bookings, New booking, Take payment, Calendar, Jobs.
const express = require("express");
const Booking = require("../../models/Booking");
const Worker = require("../../models/Worker");
const Payment = require("../../models/Payment");
const EmailLog = require("../../models/EmailLog");
const AuditLog = require("../../models/AuditLog");
const { validateBookingInput } = require("../../lib/bookingValidation");
const { createBooking, startPaystackCheckout, priceForm } = require("../../lib/bookingCreate");
const { requestRefund } = require("../../lib/refunds");
const { workerPayFor } = require("../../lib/workerPay");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { paging, searchFilter } = require("../../lib/query");
const { clean } = require("../../lib/text");
const { isValidDate, lagosDate } = require("../../lib/time");
const { round2 } = require("../../lib/money");
const { TIME_SLOTS } = require("../../lib/lagos");
const { badRequest, notFound, HttpError } = require("../../middleware/errors");
const { STATUSES } = require("../../models/Booking");

const LIST_FIELDS = "bookingId customer service schedule details.area details.duration status payment.status payment.amount assignedWorker assignedWorkerName source createdAt job.hidden";

// Allowed status changes from the admin (cancel has its own route, with refund options).
const NEXT = {
  Pending: ["Confirmed"],
  Confirmed: ["Assigned", "In Progress", "Completed"],
  Assigned: ["Confirmed", "In Progress", "Completed"],
  "In Progress": ["Completed", "Assigned"],
  Completed: [],
  Cancelled: [],
};

module.exports = function adminBookingRoutes(ctx) {
  const { auth, mailer, emails, paystack } = ctx;
  const router = express.Router();
  const managers = auth.requireAdmin("owner", "manager");
  const owner = auth.requireAdmin("owner");

  async function load(bookingId) {
    const b = await Booking.findOne({ bookingId: String(bookingId) });
    if (!b) throw notFound("Booking not found");
    return b;
  }

  // ── List / search / filter ─────────────────────────────────────────────────────────────
  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = { ...searchFilter(req.query.q, ["bookingId", "customer.firstName", "customer.lastName", "customer.email", "customer.phone", "details.address", "details.area"]) };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.paymentStatus) filter["payment.status"] = String(req.query.paymentStatus);
    if (isValidDate(req.query.from) || isValidDate(req.query.to)) {
      filter["schedule.date"] = {};
      if (isValidDate(req.query.from)) filter["schedule.date"].$gte = req.query.from;
      if (isValidDate(req.query.to)) filter["schedule.date"].$lte = req.query.to;
    }
    if (req.query.worker) filter.assignedWorker = String(req.query.worker);
    const sort = req.query.sort === "schedule" ? { "schedule.date": 1, "schedule.time": 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([Booking.find(filter).sort(sort).skip(skip).limit(limit).select(LIST_FIELDS).lean(), Booking.countDocuments(filter)]);
    res.json({ items, total, page, limit });
  });

  // ── Calendar: everything between two dates ─────────────────────────────────────────────
  router.get("/calendar", async (req, res) => {
    const { from, to } = req.query;
    if (!isValidDate(from) || !isValidDate(to) || to < from) throw badRequest("Choose a valid date range");
    if ((new Date(to) - new Date(from)) / 86400000 > 62) throw badRequest("Date range is too long");
    const items = await Booking.find({ "schedule.date": { $gte: from, $lte: to }, status: { $ne: "Cancelled" } })
      .sort({ "schedule.date": 1, "schedule.time": 1 })
      .select("bookingId customer.firstName customer.lastName service schedule details.area details.duration status assignedWorker assignedWorkerName payment.status")
      .lean();
    res.json({ items });
  });

  // ── Jobs board (what cleaners see) ─────────────────────────────────────────────────────
  router.get("/jobs", async (req, res) => {
    const items = await Booking.find({ status: { $in: ["Confirmed", "Assigned", "In Progress"] }, "schedule.date": { $gte: lagosDate() } })
      .sort({ "schedule.date": 1, "schedule.time": 1 })
      .select(`${LIST_FIELDS.replace(" job.hidden", "")} job`) // "job.hidden" and "job" together would collide
      .populate("job.visibleTo", "firstName lastName")
      .lean();
    res.json({ items });
  });

  // ── New booking by staff ───────────────────────────────────────────────────────────────
  router.post("/", async (req, res) => {
    const { data, errors } = validateBookingInput(req.body, new Date(), { admin: true });
    let price;
    try {
      price = await priceForm(req.body);
    } catch (e) {
      if (e.details) Object.assign(errors, e.details);
      else throw e;
    }
    if (Object.keys(errors).length) throw badRequest("Please check the booking details", errors);

    const payment = ["paystack", "offline", "later"].includes(req.body.payment) ? req.body.payment : "paystack";
    if (payment === "offline" && !["owner", "manager"].includes(req.admin.role)) throw new HttpError(403, "Only owners and managers can record offline payments");
    const offline = payment === "offline" ? { method: clean(req.body.offlineMethod, 40) || "Bank transfer", note: clean(req.body.offlineNote, 200) } : undefined;

    const { booking, checkout } = await createBooking(ctx, { data, price, source: "admin", payment, offline, createdBy: req.admin.name, sendEmail: req.body.sendEmail !== false });
    await logAdmin(req, "booking.create", booking.bookingId, { payment, total: price.total });
    res.status(201).json({ booking, paymentLink: checkout?.authorizationUrl || null });
  });

  // Price preview for the New booking form.
  router.post("/price", async (req, res) => {
    res.json(await priceForm(req.body));
  });

  // ── One booking ───────────────────────────────────────────────────────────────────────
  router.get("/:bookingId", async (req, res) => {
    const b = await Booking.findOne({ bookingId: String(req.params.bookingId) }).populate("assignedWorker", "firstName lastName phone").lean();
    if (!b) throw notFound("Booking not found");
    const [emailsSent, history, payments] = await Promise.all([
      EmailLog.find({ ref: b.bookingId }).sort({ createdAt: -1 }).limit(50).lean(),
      AuditLog.find({ target: b.bookingId }).sort({ createdAt: -1 }).limit(50).lean(),
      Payment.find({ bookingId: b.bookingId }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ booking: b, emails: emailsSent, history, payments });
  });

  router.patch("/:bookingId/status", async (req, res) => {
    const status = String(req.body?.status || "");
    const b = await load(req.params.bookingId);
    if (!(NEXT[b.status] || []).includes(status)) throw badRequest(`Can't change a ${b.status} booking to ${status || "that"}`);
    if (status === "Confirmed" && b.status === "Pending" && b.payment.status === "Pending" && !["owner", "manager"].includes(req.admin.role)) {
      throw new HttpError(403, "Only owners and managers can confirm an unpaid booking");
    }
    if (status === "Assigned" && !b.assignedWorker) throw badRequest("Assign a cleaner first");
    const from = b.status;
    b.status = status;
    if (status === "In Progress" && !b.job?.startedAt) b.set("job.startedAt", new Date());
    if (status === "Completed") {
      b.set("job.finishedAt", b.job?.finishedAt || new Date());
      if (b.assignedWorker && b.workerPay?.status === "none") {
        b.set("workerPay.amount", await workerPayFor(b));
        b.set("workerPay.status", "unpaid");
      }
    }
    await b.save();
    if (status === "Completed") {
      // "Your clean is done" + receipt — only once.
      const claimed = await Booking.findOneAndUpdate({ _id: b._id, "emails.completedAt": null }, { $set: { "emails.completedAt": new Date() } });
      if (claimed) await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.completed(b) });
    }
    await logAdmin(req, "booking.status", b.bookingId, { from, to: status });
    res.json({ booking: b });
  });

  router.patch("/:bookingId/assign", async (req, res) => {
    const b = await load(req.params.bookingId);
    if (["Completed", "Cancelled"].includes(b.status)) throw badRequest(`This booking is ${b.status.toLowerCase()}`);
    const workerId = req.body?.workerId || null;
    if (workerId) {
      const w = await Worker.findById(workerId);
      if (!w || w.status !== "active") throw badRequest("Choose an active cleaner");
      b.assignedWorker = w._id;
      b.assignedWorkerName = `${w.firstName} ${w.lastName}`.trim();
      if (b.status === "Confirmed") b.status = "Assigned";
    } else {
      b.assignedWorker = null;
      b.assignedWorkerName = "";
      if (b.status === "Assigned") b.status = "Confirmed";
    }
    await b.save();
    await logAdmin(req, "booking.assign", b.bookingId, { worker: b.assignedWorkerName || null });
    res.json({ booking: b });
  });

  router.patch("/:bookingId/visibility", async (req, res) => {
    const b = await load(req.params.bookingId);
    const visibleTo = Array.isArray(req.body?.visibleTo) ? req.body.visibleTo.map(String).slice(0, 50) : [];
    if (visibleTo.length && (await Worker.countDocuments({ _id: { $in: visibleTo } })) !== visibleTo.length) throw badRequest("Unknown cleaner in the list");
    b.set("job.hidden", Boolean(req.body?.hidden));
    b.set("job.visibleTo", visibleTo);
    await b.save();
    await logAdmin(req, "booking.visibility", b.bookingId, { hidden: b.job.hidden, visibleTo: visibleTo.length });
    res.json({ booking: b });
  });

  router.patch("/:bookingId/schedule", async (req, res) => {
    const b = await load(req.params.bookingId);
    const { date, time } = req.body || {};
    if (!isValidDate(date) || date < lagosDate()) throw badRequest("Choose today or a later date", { date: "Choose today or a later date" });
    if (!TIME_SLOTS.includes(time)) throw badRequest("Choose a time between 8am and 6pm", { time: "Choose a time between 8am and 6pm" });
    const from = `${b.schedule.date} ${b.schedule.time}`;
    b.schedule = { date, time };
    b.set("emails.reminderAt", null);
    await b.save();
    await logAdmin(req, "booking.reschedule", b.bookingId, { from, to: `${date} ${time}` });
    res.json({ booking: b });
  });

  router.post("/:bookingId/notes", async (req, res) => {
    const text = clean(req.body?.text, 1000);
    if (!text) throw badRequest("Write a note first");
    const b = await Booking.findOneAndUpdate(
      { bookingId: String(req.params.bookingId) },
      { $push: { notes: { text, by: req.admin.name, at: new Date() } } },
      { new: true },
    );
    if (!b) throw notFound("Booking not found");
    res.json({ booking: b });
  });

  // Resend: confirmation (paid), payment link (unpaid), invoice/receipt (paid).
  router.post("/:bookingId/resend", async (req, res) => {
    const b = await load(req.params.bookingId);
    const type = String(req.body?.type || "");
    let mail;
    if (type === "confirmation") {
      if (b.payment.status !== "Paid") throw badRequest("This booking isn't paid yet — send the payment link instead");
      mail = emails.confirmed(b);
    } else if (type === "payment-link") {
      if (b.payment.status !== "Pending") throw badRequest("This booking doesn't need paying");
      if (!b.payment.authorizationUrl) throw badRequest("Create a payment link first (Take payment)");
      mail = emails.received(b);
    } else if (type === "invoice") {
      if (!["Paid", "Refunded", "Refund pending"].includes(b.payment.status)) throw badRequest("There's no payment to show on a receipt yet");
      mail = emails.completed(b);
    } else {
      throw badRequest("Choose which email to resend");
    }
    const r = await mailer.send({ to: b.customer.email, ref: b.bookingId, ...mail });
    await logAdmin(req, "booking.resend", b.bookingId, { type, status: r.status });
    res.json({ ok: r.status !== "failed", status: r.status });
  });

  // ── Take payment ──────────────────────────────────────────────────────────────────────
  router.post("/:bookingId/payment-link", async (req, res) => {
    const b = await load(req.params.bookingId);
    if (b.payment.status !== "Pending") throw badRequest("This booking doesn't need paying");
    if (b.status === "Cancelled") throw badRequest("This booking is cancelled");
    if (!b.payment.authorizationUrl) {
      const checkout = await startPaystackCheckout(ctx, { bookingId: b.bookingId, email: b.customer.email, amount: b.payment.amount, serviceName: b.service });
      b.payment.reference = checkout.reference;
      b.payment.authorizationUrl = checkout.authorizationUrl;
      b.payment.method = "Paystack";
      await b.save();
    }
    if (req.body?.email !== false) {
      await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.received(b) });
    }
    await logAdmin(req, "booking.payment-link", b.bookingId);
    res.json({ paymentLink: b.payment.authorizationUrl });
  });

  router.post("/:bookingId/mark-paid", managers, async (req, res) => {
    const method = clean(req.body?.method, 40);
    if (!method) throw badRequest("Say how it was paid (e.g. bank transfer, cash)");
    const note = clean(req.body?.note, 200);
    const b = await Booking.findOneAndUpdate(
      { bookingId: String(req.params.bookingId), "payment.status": "Pending", status: { $ne: "Cancelled" } },
      [{
        $set: {
          "payment.status": "Paid", "payment.paidAt": "$$NOW", "payment.method": method,
          "payment.offline": { method, note, by: req.admin.name },
          status: { $cond: [{ $eq: ["$status", "Pending"] }, "Confirmed", "$status"] },
        },
      }],
      { new: true },
    );
    if (!b) throw badRequest("This booking can't be marked as paid");
    await Payment.updateOne(
      { reference: `OFFLINE-${b.bookingId}` },
      { $setOnInsert: { reference: `OFFLINE-${b.bookingId}`, booking: b._id, bookingId: b.bookingId, amount: b.payment.amount, currency: "NGN", status: "success", channel: method, paidAt: new Date(), email: b.customer.email } },
      { upsert: true },
    );
    await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.confirmed(b) });
    await logAdmin(req, "booking.mark-paid", b.bookingId, { method, note });
    res.json({ booking: b });
  });

  // ── Cancel / refund ───────────────────────────────────────────────────────────────────
  router.post("/:bookingId/cancel", managers, async (req, res) => {
    let b = await load(req.params.bookingId);
    if (["Completed", "Cancelled"].includes(b.status)) throw badRequest(`This booking is already ${b.status.toLowerCase()}`);
    const reason = clean(req.body?.reason, 300);
    b.status = "Cancelled";
    b.cancellation = { at: new Date(), by: req.admin.name, reason };
    await b.save();
    if (req.body?.refund && b.payment.status === "Paid") {
      b = await requestRefund(paystack, b, { amount: req.body.refundAmount, reason, by: req.admin.name });
    }
    if (req.body?.notifyCustomer !== false) await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.cancelled(b, reason) });
    await logAdmin(req, "booking.cancel", b.bookingId, { reason, refund: Boolean(req.body?.refund) });
    res.json({ booking: b });
  });

  router.post("/:bookingId/refund", managers, async (req, res) => {
    const b = await load(req.params.bookingId);
    const updated = await requestRefund(paystack, b, { amount: req.body?.amount, reason: clean(req.body?.reason, 300), by: req.admin.name });
    await logAdmin(req, "booking.refund", b.bookingId, { amount: updated.payment.refund.amount });
    res.json({ booking: updated });
  });

  router.patch("/:bookingId/worker-pay", managers, async (req, res) => {
    const amount = round2(req.body?.amount);
    if (!(amount >= 0) || amount > 10_000_000) throw badRequest("Enter a valid amount");
    const b = await Booking.findOneAndUpdate(
      { bookingId: String(req.params.bookingId), "workerPay.status": { $in: ["none", "unpaid"] } },
      { $set: { "workerPay.amount": amount } },
      { new: true },
    );
    if (!b) throw badRequest("This cleaner pay is already being paid out");
    await logAdmin(req, "booking.worker-pay", b.bookingId, { amount });
    res.json({ booking: b });
  });

  router.delete("/:bookingId", owner, async (req, res) => {
    const b = await load(req.params.bookingId);
    await moveToBin(b, { label: `Booking ${b.bookingId} — ${b.customer.firstName} ${b.customer.lastName}`, deletedBy: req.admin.name });
    await logAdmin(req, "booking.delete", b.bookingId);
    res.json({ ok: true });
  });

  return router;
};
