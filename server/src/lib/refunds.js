// Refunds through Paystack. Admin asks → "Refund pending"; Paystack's refund.processed webhook → "Refunded".
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { toKobo, round2 } = require("./money");
const { HttpError } = require("../middleware/errors");

async function requestRefund(paystack, booking, { amount, reason, by }) {
  if (booking.payment?.status !== "Paid") throw new HttpError(400, "Only paid bookings can be refunded");
  if (!booking.payment.reference || booking.payment.offline?.method) throw new HttpError(400, "This booking wasn't paid through Paystack — refund it the way it was paid");
  const value = amount === undefined || amount === null || amount === "" ? booking.payment.amount : round2(amount);
  if (!(value > 0) || value > booking.payment.amount) throw new HttpError(400, `Refund must be between ₦1 and ₦${booking.payment.amount}`);

  // Claim the booking so the refund is only requested once.
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, "payment.status": "Paid" },
    { $set: { "payment.status": "Refund pending", "payment.refund": { amount: value, status: "pending", requestedAt: new Date(), by, reason } } },
    { new: true },
  );
  if (!claimed) throw new HttpError(409, "A refund is already in progress");
  try {
    const r = await paystack.refund({ reference: booking.payment.reference, amountKobo: value === booking.payment.amount ? undefined : toKobo(value) });
    await Booking.updateOne({ _id: booking._id }, { $set: { "payment.refund.providerId": String(r?.id || "") } });
  } catch (e) {
    await Booking.updateOne({ _id: booking._id }, { $set: { "payment.status": "Paid", "payment.refund.status": "failed" } });
    throw e;
  }
  return Booking.findById(booking._id);
}

async function handleRefundEvent(type, data) {
  const reference = String(data?.transaction_reference || data?.transaction?.reference || "");
  if (!reference) return;
  if (type === "refund.processed") {
    const b = await Booking.findOneAndUpdate(
      { "payment.reference": reference, "payment.status": "Refund pending" },
      { $set: { "payment.status": "Refunded", "payment.refund.status": "processed", "payment.refund.processedAt": new Date() } },
      { new: true },
    );
    if (b) await Payment.updateOne({ reference }, { $set: { status: "refunded" } });
  } else {
    await Booking.updateOne({ "payment.reference": reference, "payment.status": "Refund pending" }, { $set: { "payment.status": "Paid", "payment.refund.status": "failed" } });
  }
}

module.exports = { requestRefund, handleRefundEvent };
