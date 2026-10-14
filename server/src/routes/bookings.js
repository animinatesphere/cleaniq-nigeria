// Public booking flow: price the form, create the booking + Paystack payment, check status after paying.
const express = require("express");
const Booking = require("../models/Booking");
const { validateBookingInput } = require("../lib/bookingValidation");
const { createBooking, priceForm } = require("../lib/bookingCreate");
const { badRequest, notFound } = require("../middleware/errors");
const { LAGOS_AREAS, PROPERTY_TYPES, PARKING_OPTIONS, ACCESS_OPTIONS, TIME_SLOTS, MAX_DAYS_AHEAD } = require("../lib/lagos");
const { lagosDate, addDays } = require("../lib/time");

// Only what the "payment status" page needs — no personal details.
const publicStatus = (b) => ({
  bookingId: b.bookingId, status: b.status, paymentStatus: b.payment?.status, service: b.service,
  date: b.schedule?.date, time: b.schedule?.time, total: b.payment?.amount, currency: "NGN",
});

module.exports = function bookingRoutes(ctx) {
  const { limiters, paystack, confirmPayment } = ctx;
  const router = express.Router();

  // Form options, so the website and the server always use the same lists.
  router.get("/options", (req, res) => {
    const today = lagosDate();
    res.json({
      areas: LAGOS_AREAS, propertyTypes: PROPERTY_TYPES, parking: PARKING_OPTIONS, access: ACCESS_OPTIONS,
      timeSlots: TIME_SLOTS, minDate: addDays(today, 1), maxDate: addDays(today, MAX_DAYS_AHEAD),
    });
  });

  // The exact price for the current form choices (the website shows this; it never calculates prices itself).
  router.post("/quote-price", limiters.publicForm, async (req, res) => {
    res.json(await priceForm(req.body));
  });

  router.post("/", limiters.publicForm, async (req, res) => {
    // Check the details and the price together so the customer sees every problem at once.
    const { data, errors } = validateBookingInput(req.body);
    let price;
    try {
      price = await priceForm(req.body);
    } catch (e) {
      if (e.details) Object.assign(errors, e.details);
      else throw e;
    }
    if (Object.keys(errors).length) throw badRequest("Please check your booking details", errors);

    const { booking, checkout } = await createBooking(ctx, { data, price, source: "website", payment: "paystack" });
    res.status(201).json({ bookingId: booking.bookingId, reference: checkout.reference, authorizationUrl: checkout.authorizationUrl, accessCode: checkout.accessCode, total: price.total, currency: "NGN" });
  });

  // After Paystack sends the customer back. Needs the payment reference (only the payer has it).
  // If the webhook hasn't arrived yet, ask Paystack directly — never trust the redirect by itself.
  router.get("/:bookingId/status", limiters.publicForm, async (req, res) => {
    const reference = String(req.query.reference || "");
    const booking = await Booking.findOne({ bookingId: String(req.params.bookingId) });
    if (!booking || !reference || booking.payment?.reference !== reference) throw notFound("Booking not found");

    if (booking.payment.status === "Pending") {
      try {
        const tx = await paystack.verify(reference);
        if (tx?.status === "success") {
          const r = await confirmPayment(tx);
          if (r.booking) return res.json(publicStatus(r.booking));
          return res.json(publicStatus(await Booking.findById(booking._id)));
        }
      } catch {
        // Paystack unreachable — the webhook will still confirm it; show "pending".
      }
    }
    res.json(publicStatus(booking));
  });

  return router;
};
