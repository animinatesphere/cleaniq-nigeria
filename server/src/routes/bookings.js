// Public booking flow: price the form, create the booking + Paystack payment, check status after paying.
const crypto = require("node:crypto");
const express = require("express");
const Booking = require("../models/Booking");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Service = require("../models/Service");
const { priceBooking } = require("../lib/pricing");
const { getPricingSettings } = require("../lib/settings");
const { validateBookingInput } = require("../lib/bookingValidation");
const { toKobo } = require("../lib/money");
const { badRequest, notFound } = require("../middleware/errors");
const { LAGOS_AREAS, PROPERTY_TYPES, PARKING_OPTIONS, ACCESS_OPTIONS, TIME_SLOTS, MAX_DAYS_AHEAD } = require("../lib/lagos");
const { lagosDate, addDays } = require("../lib/time");

async function newBookingId() {
  for (let i = 0; i < 10; i++) {
    const id = `NG-${crypto.randomInt(100000, 1000000)}`;
    if (!(await Booking.exists({ bookingId: id }))) return id;
  }
  throw new Error("Could not create a booking reference");
}

async function priceFromBody(body) {
  const [services, settings] = await Promise.all([Service.find({ active: true }).lean(), getPricingSettings()]);
  return priceBooking(services, settings, {
    service: body?.service, frequency: body?.frequency, hours: body?.hours, extras: body?.extras, supplies: body?.supplies,
  });
}

// Only what the "payment status" page needs — no personal details.
const publicStatus = (b) => ({
  bookingId: b.bookingId, status: b.status, paymentStatus: b.payment?.status, service: b.service,
  date: b.schedule?.date, time: b.schedule?.time, total: b.payment?.amount, currency: "NGN",
});

module.exports = function bookingRoutes({ config, limiters, mailer, paystack, emails, confirmPayment }) {
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
    res.json(await priceFromBody(req.body));
  });

  router.post("/", limiters.publicForm, async (req, res) => {
    // Check the details and the price together so the customer sees every problem at once.
    const { data, errors } = validateBookingInput(req.body);
    let price;
    try {
      price = await priceFromBody(req.body);
    } catch (e) {
      if (e.details) Object.assign(errors, e.details);
      else throw e;
    }
    if (Object.keys(errors).length) throw badRequest("Please check your booking details", errors);

    const bookingId = await newBookingId();
    const reference = `${bookingId}-${crypto.randomBytes(3).toString("hex")}`;
    const tx = await paystack.initialize({
      email: data.email,
      amountKobo: toKobo(price.total),
      reference,
      callbackUrl: `${config.frontendUrl}/payment/success?booking=${bookingId}&reference=${reference}`,
      metadata: { bookingId, service: price.service.name, cancel_action: `${config.frontendUrl}/booking` },
    });

    const customer = await Customer.findOneAndUpdate(
      { email: data.email },
      { $setOnInsert: { email: data.email, firstName: data.firstName, lastName: data.lastName, phone: data.phone, area: data.area, address: data.address } },
      { upsert: true, new: true },
    );

    const booking = await Booking.create({
      bookingId,
      customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone },
      customerId: customer._id,
      service: price.service.name,
      serviceSlug: price.service.slug,
      details: {
        area: data.area, address: data.address, landmark: data.landmark, duration: price.hours, frequency: price.frequency.key,
        propertyType: data.propertyType, rooms: data.rooms, extras: price.extras, pets: data.pets, supplies: price.supplies,
        parking: data.parking, access: data.access, instructions: data.instructions,
      },
      schedule: { date: data.date, time: data.time },
      price: { lines: price.lines, subtotal: price.subtotal, vat: price.vat, total: price.total },
      payment: { amount: price.total, currency: "NGN", status: "Pending", method: "Paystack", reference, authorizationUrl: tx.authorization_url },
      status: "Pending",
      source: "website",
    });

    await Lead.create({ name: `${data.firstName} ${data.lastName}`, email: data.email, phone: data.phone, area: data.area, source: "booking", stage: "quoted", ref: bookingId }).catch(() => {});
    await mailer.send({ to: data.email, ref: bookingId, ...emails.received(booking) });
    await Booking.updateOne({ _id: booking._id }, { $set: { "emails.receivedAt": new Date() } });

    res.status(201).json({ bookingId, reference, authorizationUrl: tx.authorization_url, accessCode: tx.access_code, total: price.total, currency: "NGN" });
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
