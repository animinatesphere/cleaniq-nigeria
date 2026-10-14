// Public quote page: view and accept (the email link carries a secret token).
const crypto = require("node:crypto");
const express = require("express");
const Quote = require("../models/Quote");
const Lead = require("../models/Lead");
const { expireQuotes } = require("../lib/quotes");
const { createBooking } = require("../lib/bookingCreate");
const { isValidDate, lagosDate, addDays } = require("../lib/time");
const { TIME_SLOTS, MAX_DAYS_AHEAD } = require("../lib/lagos");
const { badRequest, notFound } = require("../middleware/errors");

function tokenMatches(q, t) {
  const a = Buffer.from(String(q?.token || ""));
  const b = Buffer.from(String(t || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// What the customer sees — no email or phone in the response.
const publicQuote = (q) => ({
  quoteRef: q.quoteRef, status: q.status, firstName: q.customer?.firstName, area: q.details?.area,
  items: q.items, subtotal: q.subtotal, discount: q.discount, vat: q.vat, grandTotal: q.grandTotal,
  validUntil: q.validUntil, serviceDate: q.serviceDate, serviceTime: q.serviceTime, bookingId: q.bookingId,
});

module.exports = function quoteRoutes(ctx) {
  const router = express.Router();
  const { limiters } = ctx;

  async function load(req) {
    await expireQuotes();
    const q = await Quote.findOne({ quoteRef: String(req.params.ref) }).select("+token");
    if (!q || !tokenMatches(q, req.query.t || req.body?.t)) throw notFound("Quote not found");
    return q;
  }

  router.get("/:ref", limiters.publicForm, async (req, res) => {
    const q = await load(req);
    const today = lagosDate();
    res.json({ quote: publicQuote(q), timeSlots: TIME_SLOTS, minDate: addDays(today, 1), maxDate: addDays(today, MAX_DAYS_AHEAD) });
  });

  // Accept → a Pending booking + Paystack payment link. Follow-ups for this quote stop.
  router.post("/:ref/accept", limiters.publicForm, async (req, res) => {
    const q = await load(req);
    const { date, time } = req.body || {};
    const errors = {};
    const today = lagosDate();
    if (!isValidDate(date) || date < addDays(today, 1) || date > addDays(today, MAX_DAYS_AHEAD)) errors.date = "Please choose a date from tomorrow onwards";
    if (!TIME_SLOTS.includes(time)) errors.time = "Please choose an arrival time between 8am and 6pm";
    if (Object.keys(errors).length) throw badRequest("Please choose a date and time", errors);
    if (q.status !== "Sent") throw badRequest(q.status === "Expired" ? "This quote has expired — ask us for a new one" : `This quote is already ${q.status.toLowerCase()}`);

    // Claim the quote so it can only be accepted once.
    const claimed = await Quote.findOneAndUpdate({ _id: q._id, status: "Sent" }, { $set: { status: "Accepted", acceptedAt: new Date(), followUpsStopped: true, serviceDate: date, serviceTime: time } }, { new: true });
    if (!claimed) throw badRequest("This quote has already been accepted");

    const hourly = q.items.filter((i) => i.billingType === "hourly");
    const main = q.items.find((i) => i.serviceSlug !== "supplies") || q.items[0];
    const lines = q.items.map((i) => ({ key: `quote:${i.serviceSlug}`, label: `${i.service}${i.option ? ` (${i.option})` : ""}${i.billingType === "hourly" ? ` — ${i.qty} hours` : ""}`, qty: i.billingType === "hourly" ? 1 : i.qty, unitPrice: i.billingType === "hourly" ? i.subtotal : i.unitPrice, amount: i.subtotal }));
    if (q.discount?.amount) lines.push({ key: "discount", label: q.discount.label || "Discount", qty: 1, unitPrice: -q.discount.amount, amount: -q.discount.amount });
    const price = {
      service: { name: q.items.length > 1 ? `${main.service} + more` : main.service, slug: main.serviceSlug },
      hours: hourly.reduce((s, i) => s + i.qty, 0) || undefined,
      frequency: { key: q.details?.frequency || "once" },
      extras: q.items.flatMap((i) => i.extras || []),
      supplies: q.details?.supplies,
      lines, subtotal: q.subtotal, vat: q.vat, total: q.grandTotal,
    };
    const data = {
      firstName: q.customer.firstName, lastName: q.customer.lastName, email: q.customer.email, phone: q.customer.phone,
      area: q.details?.area, address: q.details?.address, landmark: q.details?.landmark, propertyType: q.details?.propertyType,
      rooms: q.details?.rooms, pets: q.details?.pets, instructions: q.details?.notes, date, time,
    };
    try {
      const { booking, checkout } = await createBooking(ctx, { data, price, source: "quote", payment: "paystack", quote: q });
      await Quote.updateOne({ _id: q._id }, { $set: { booking: booking._id, bookingId: booking.bookingId } });
      await Lead.updateMany({ ref: q.quoteRef }, { $set: { stage: "won" } });
      res.status(201).json({ bookingId: booking.bookingId, authorizationUrl: checkout.authorizationUrl, reference: checkout.reference });
    } catch (e) {
      await Quote.updateOne({ _id: q._id, status: "Accepted", booking: null }, { $set: { status: "Sent", followUpsStopped: false }, $unset: { acceptedAt: "" } });
      throw e;
    }
  });

  return router;
};
