// Confirms a booking's payment exactly once, whether the news comes from the Paystack webhook or a
// server-side verify call. Paystack may send the same event more than once; only the first one counts.
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { toKobo, fromKobo } = require("./money");
const { confirmInvoicePayment } = require("./invoices");

function createPaymentConfirmer({ mailer, emails, config }) {
  // tx = Paystack transaction data: { reference, amount (kobo), currency, channel, paid_at, customer }
  return async function confirmPayment(tx) {
    const reference = String(tx?.reference || "");
    const booking = reference ? await Booking.findOne({ "payment.reference": reference }) : null;
    if (!booking) return confirmInvoicePayment(tx); // invoices / payment links / monthly plans

    if (Number(tx.amount) !== toKobo(booking.payment.amount) || String(tx.currency || "").toUpperCase() !== "NGN") {
      await Booking.updateOne({ _id: booking._id, "payment.status": "Pending" }, { $set: { "payment.problem": `Paystack reported ${tx.currency} ${fromKobo(tx.amount)} but the booking is NGN ${booking.payment.amount}` } });
      await Payment.updateOne({ reference }, { $setOnInsert: { reference, booking: booking._id, bookingId: booking.bookingId, amount: fromKobo(tx.amount), currency: tx.currency, status: "mismatch" } }, { upsert: true });
      return { result: "amount-mismatch" };
    }

    const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
    // Atomic: only a booking still waiting for payment is updated. A booking cancelled before the
    // money arrived is marked paid (for a refund) but stays Cancelled.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, "payment.status": "Pending" },
      [{
        $set: {
          "payment.status": "Paid",
          "payment.paidAt": paidAt,
          "payment.method": "Paystack",
          "payment.channel": String(tx.channel || ""),
          status: { $cond: [{ $eq: ["$status", "Pending"] }, "Confirmed", "$status"] },
        },
      }],
      { new: true },
    );
    if (!updated) return { result: "already-processed" };

    await Payment.updateOne(
      { reference },
      { $setOnInsert: { reference, booking: updated._id, bookingId: updated.bookingId, amount: updated.payment.amount, currency: "NGN", status: "success", channel: tx.channel, paidAt, email: updated.customer?.email } },
      { upsert: true },
    );

    if (updated.status === "Confirmed") {
      await mailer.send({ to: updated.customer.email, ref: updated.bookingId, ...emails.confirmed(updated) });
      await Booking.updateOne({ _id: updated._id }, { $set: { "emails.confirmedAt": new Date() } });
      if (config.teamEmail) await mailer.send({ to: config.teamEmail, ref: updated.bookingId, ...emails.team(updated) });
    }
    return { result: "confirmed", booking: updated };
  };
}

module.exports = { createPaymentConfirmer };
