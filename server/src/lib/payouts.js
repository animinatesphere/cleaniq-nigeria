// Paying cleaners with Paystack Transfers. A withdrawal moves Requested → Processing → Paid/Failed;
// each step is an atomic update so a repeated webhook can't pay or settle twice.
const crypto = require("node:crypto");
const Booking = require("../models/Booking");
const Withdrawal = require("../models/Withdrawal");
const Worker = require("../models/Worker");
const { toKobo } = require("./money");
const { HttpError } = require("../middleware/errors");

// Starts the bank transfer for a Requested withdrawal. Returns the updated withdrawal.
async function startPayout(paystack, withdrawalId, adminName) {
  // Claim it first so two clicks can't send two transfers.
  const w = await Withdrawal.findOneAndUpdate(
    { _id: withdrawalId, status: "Requested" },
    { $set: { status: "Processing", reviewedBy: adminName, reference: `PAY-${crypto.randomBytes(8).toString("hex")}` } },
    { new: true },
  );
  if (!w) throw new HttpError(409, "This payout is already being processed");

  try {
    const worker = await Worker.findById(w.worker);
    const bank = worker?.bank || {};
    if (!bank.accountNumber || !bank.bankCode) throw new HttpError(400, "This cleaner has no bank details yet");
    if (!bank.recipientCode) {
      const r = await paystack.createRecipient({ name: bank.accountName || `${worker.firstName} ${worker.lastName}`, accountNumber: bank.accountNumber, bankCode: bank.bankCode });
      worker.bank.recipientCode = r.recipient_code;
      await worker.save();
    }
    const t = await paystack.transfer({ amountKobo: toKobo(w.amount), recipient: worker.bank.recipientCode, reference: w.reference, reason: `Cleaniq pay ${w.reference}` });
    w.transferCode = t.transfer_code;
    w.bank = { bankName: bank.bankName, accountNumber: `******${String(bank.accountNumber).slice(-4)}`, accountName: bank.accountName };
    await w.save();
    await Booking.updateMany({ _id: { $in: w.bookings } }, { $set: { "workerPay.status": "processing", "workerPay.withdrawal": w._id } });
    return w;
  } catch (e) {
    // Put it back so admin can try again after fixing the problem.
    await Withdrawal.updateOne({ _id: w._id, status: "Processing" }, { $set: { status: "Requested", failureReason: e.provider || e.message } });
    throw e;
  }
}

async function handleTransferEvent(type, data) {
  const reference = String(data?.reference || "");
  if (!reference) return;
  if (type === "transfer.success") {
    const w = await Withdrawal.findOneAndUpdate({ reference, status: "Processing" }, { $set: { status: "Paid", paidAt: new Date() } }, { new: true });
    if (w) await Booking.updateMany({ _id: { $in: w.bookings } }, { $set: { "workerPay.status": "paid" } });
  } else {
    const w = await Withdrawal.findOneAndUpdate(
      { reference, status: "Processing" },
      { $set: { status: "Failed", failureReason: data?.reason || type }, $unset: { payrollKey: "" } },
      { new: true },
    );
    if (w) await Booking.updateMany({ _id: { $in: w.bookings } }, { $set: { "workerPay.status": "unpaid" }, $unset: { "workerPay.withdrawal": "" } });
  }
}

module.exports = { startPayout, handleTransferEvent };
