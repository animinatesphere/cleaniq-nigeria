// Day-before reminders. Runs every 15 minutes; each booking gets one reminder (claimed atomically).
const Booking = require("../models/Booking");
const { lagosDate, addDays } = require("../lib/time");

async function sendDueReminders({ mailer, emails }, now = new Date()) {
  const tomorrow = addDays(lagosDate(now), 1);
  let sent = 0;
  for (;;) {
    const b = await Booking.findOneAndUpdate(
      { "schedule.date": tomorrow, status: { $in: ["Confirmed", "Assigned"] }, "emails.reminderAt": null },
      { $set: { "emails.reminderAt": now } },
      { new: true },
    );
    if (!b) break;
    await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.reminder(b) });
    sent++;
  }
  return sent;
}

module.exports = { sendDueReminders };
