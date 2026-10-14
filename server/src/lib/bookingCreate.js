// Creates a booking — used by the website, by staff in the admin, and when a customer accepts a quote.
// payment: "paystack" (checkout link, emailed), "offline" (already paid cash/transfer → confirmed), "later" (no link yet).
const crypto = require("node:crypto");
const Booking = require("../models/Booking");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Payment = require("../models/Payment");
const Service = require("../models/Service");
const { toKobo } = require("./money");
const { priceBooking } = require("./pricing");
const { getPricingSettings } = require("./settings");

// Prices a booking form from the live price list and settings (never from amounts the browser sends).
async function priceForm(body) {
  const [services, settings] = await Promise.all([Service.find({ active: true }).lean(), getPricingSettings()]);
  return priceBooking(services, settings, {
    service: body?.service, frequency: body?.frequency, hours: body?.hours, extras: body?.extras, supplies: body?.supplies,
  });
}

async function newBookingId() {
  for (let i = 0; i < 10; i++) {
    const id = `NG-${crypto.randomInt(100000, 1000000)}`;
    if (!(await Booking.exists({ bookingId: id }))) return id;
  }
  throw new Error("Could not create a booking reference");
}

const newReference = (bookingId) => `${bookingId}-${crypto.randomBytes(3).toString("hex")}`;

async function startPaystackCheckout({ config, paystack }, { bookingId, email, amount, serviceName }) {
  const reference = newReference(bookingId);
  const tx = await paystack.initialize({
    email,
    amountKobo: toKobo(amount),
    reference,
    callbackUrl: `${config.frontendUrl}/payment/success?booking=${bookingId}&reference=${reference}`,
    metadata: { bookingId, service: serviceName, cancel_action: `${config.frontendUrl}/booking` },
  });
  return { reference, authorizationUrl: tx.authorization_url, accessCode: tx.access_code };
}

async function createBooking(ctx, { data, price, source = "website", payment = "paystack", offline, createdBy, quote, sendEmail = true }) {
  const { mailer, emails } = ctx;
  const bookingId = await newBookingId();
  const checkout = payment === "paystack"
    ? await startPaystackCheckout(ctx, { bookingId, email: data.email, amount: price.total, serviceName: price.service.name })
    : null;

  const customer = await Customer.findOneAndUpdate(
    { email: data.email },
    { $setOnInsert: { email: data.email, firstName: data.firstName, lastName: data.lastName, phone: data.phone, area: data.area, address: data.address } },
    { upsert: true, new: true },
  );

  const paidOffline = payment === "offline";
  const booking = await Booking.create({
    bookingId,
    customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone },
    customerId: customer._id,
    service: price.service.name,
    serviceSlug: price.service.slug,
    details: {
      area: data.area, address: data.address, landmark: data.landmark, duration: price.hours, frequency: price.frequency?.key || "once",
      propertyType: data.propertyType, rooms: data.rooms, extras: price.extras || [], pets: data.pets, supplies: price.supplies,
      parking: data.parking, access: data.access, instructions: data.instructions,
    },
    schedule: { date: data.date, time: data.time },
    price: { lines: price.lines, subtotal: price.subtotal, vat: price.vat, total: price.total },
    payment: {
      amount: price.total, currency: "NGN",
      status: paidOffline ? "Paid" : "Pending",
      method: paidOffline ? offline?.method || "Offline" : "Paystack",
      reference: checkout?.reference || (paidOffline ? `OFFLINE-${bookingId}` : undefined),
      authorizationUrl: checkout?.authorizationUrl,
      paidAt: paidOffline ? new Date() : undefined,
      offline: paidOffline ? { method: offline?.method || "Offline", note: offline?.note || "", by: createdBy } : undefined,
    },
    status: paidOffline ? "Confirmed" : "Pending",
    source,
    quoteRef: quote?.quoteRef,
    notes: createdBy ? [{ text: `Created by ${createdBy}`, by: createdBy }] : [],
  });

  if (paidOffline) {
    await Payment.create({ reference: booking.payment.reference, booking: booking._id, bookingId, amount: price.total, currency: "NGN", status: "success", channel: offline?.method || "offline", paidAt: new Date(), email: data.email });
  }
  if (source !== "quote") {
    await Lead.create({ name: `${data.firstName} ${data.lastName}`, email: data.email, phone: data.phone, area: data.area, source: source === "admin" ? "admin" : "booking", stage: paidOffline ? "won" : "quoted", ref: bookingId }).catch(() => {});
  }

  if (sendEmail) {
    if (paidOffline) {
      await mailer.send({ to: data.email, ref: bookingId, ...emails.confirmed(booking) });
      await Booking.updateOne({ _id: booking._id }, { $set: { "emails.confirmedAt": new Date() } });
    } else if (checkout) {
      await mailer.send({ to: data.email, ref: bookingId, ...emails.received(booking) });
      await Booking.updateOne({ _id: booking._id }, { $set: { "emails.receivedAt": new Date() } });
    }
  }
  return { booking, checkout };
}

module.exports = { createBooking, startPaystackCheckout, newBookingId, priceForm };
