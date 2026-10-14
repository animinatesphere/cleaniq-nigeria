// Admin → Customers and customer profile.
const express = require("express");
const Customer = require("../../models/Customer");
const Booking = require("../../models/Booking");
const EmailLog = require("../../models/EmailLog");
const { paging, searchFilter } = require("../../lib/query");
const { clean, normaliseNgPhone } = require("../../lib/text");
const { logAdmin } = require("../../lib/audit");
const { moveToBin } = require("../../lib/bin");
const { round2 } = require("../../lib/money");
const { notFound, badRequest } = require("../../middleware/errors");

const PUBLIC_FIELDS = "firstName lastName email phone area address tags notes emailVerified lastLoginAt createdAt";

module.exports = function adminCustomerRoutes({ auth }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const { page, limit, skip } = paging(req.query);
    const filter = searchFilter(req.query.q, ["firstName", "lastName", "email", "phone", "area"]);
    if (req.query.tag) filter.tags = String(req.query.tag);
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select(PUBLIC_FIELDS).lean(),
      Customer.countDocuments(filter),
    ]);
    // Bookings count and total paid for this page of customers.
    const stats = await Booking.aggregate([
      { $match: { customerId: { $in: items.map((c) => c._id) } } },
      { $group: { _id: "$customerId", bookings: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ["$payment.status", "Paid"] }, "$payment.amount", 0] } }, last: { $max: "$schedule.date" } } },
    ]);
    const byId = new Map(stats.map((s) => [String(s._id), s]));
    res.json({
      items: items.map((c) => ({ ...c, bookings: byId.get(String(c._id))?.bookings || 0, spent: round2(byId.get(String(c._id))?.spent || 0), lastBooking: byId.get(String(c._id))?.last || null })),
      total, page, limit,
    });
  });

  router.get("/:id", async (req, res) => {
    const customer = await Customer.findById(req.params.id).select(PUBLIC_FIELDS).lean();
    if (!customer) throw notFound("Customer not found");
    const [bookings, emails] = await Promise.all([
      Booking.find({ customerId: customer._id }).sort({ createdAt: -1 }).select("bookingId service schedule status payment.status payment.amount createdAt notes").lean(),
      EmailLog.find({ to: customer.email }).sort({ createdAt: -1 }).limit(100).select("subject type status createdAt ref").lean(),
    ]);
    // Timeline: account, bookings, payments, emails, booking notes — newest first.
    const timeline = [
      { at: customer.createdAt, kind: "account", text: "Customer added" },
      ...bookings.map((b) => ({ at: b.createdAt, kind: "booking", text: `Booked ${b.service} for ${b.schedule?.date} (${b.bookingId})`, ref: b.bookingId })),
      ...bookings.flatMap((b) => (b.notes || []).map((n) => ({ at: n.at, kind: "note", text: n.text, by: n.by, ref: b.bookingId }))),
      ...emails.map((e) => ({ at: e.createdAt, kind: "email", text: `${e.status === "sent" ? "Email sent" : `Email ${e.status}`}: ${e.subject}`, ref: e.ref })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
    const spent = round2(bookings.filter((b) => b.payment?.status === "Paid").reduce((s, b) => s + (b.payment.amount || 0), 0));
    res.json({ customer, bookings, timeline, spent });
  });

  router.patch("/:id", async (req, res) => {
    const c = await Customer.findById(req.params.id);
    if (!c) throw notFound("Customer not found");
    const b = req.body || {};
    if (b.firstName !== undefined) c.firstName = clean(b.firstName, 50);
    if (b.lastName !== undefined) c.lastName = clean(b.lastName, 50);
    if (b.phone !== undefined) {
      const phone = b.phone ? normaliseNgPhone(b.phone) : "";
      if (b.phone && !phone) throw badRequest("Enter a Nigerian mobile number", { phone: "Enter a Nigerian mobile number" });
      c.phone = phone;
    }
    if (b.area !== undefined) c.area = clean(b.area, 60);
    if (b.address !== undefined) c.address = clean(b.address, 200);
    if (b.notes !== undefined) c.notes = clean(b.notes, 2000);
    if (Array.isArray(b.tags)) c.tags = [...new Set(b.tags.map((t) => clean(t, 30)).filter(Boolean))].slice(0, 20);
    await c.save();
    await logAdmin(req, "customer.update", c.email);
    res.json({ customer: await Customer.findById(c._id).select(PUBLIC_FIELDS).lean() });
  });

  router.delete("/:id", auth.requireAdmin("owner", "manager"), async (req, res) => {
    const c = await Customer.findById(req.params.id);
    if (!c) throw notFound("Customer not found");
    await moveToBin(c, { label: `Customer ${c.firstName} ${c.lastName} <${c.email}>`, deletedBy: req.admin.name });
    await logAdmin(req, "customer.delete", c.email);
    res.json({ ok: true });
  });

  return router;
};
