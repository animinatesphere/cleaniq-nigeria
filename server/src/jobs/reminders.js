// Day-before reminders. Runs every 15 minutes; each booking gets one reminder (claimed atomically).
const Booking = require("../models/Booking");
const { lagosDate, addDays, formatLagosDate, formatTime } = require("../lib/time");
const { getSmsSettings, fill } = require("../lib/automations");

async function sendDueReminders({ mailer, emails, sms }, now = new Date()) {
  const tomorrow = addDays(lagosDate(now), 1);
  const text = await getSmsSettings();
  let sent = 0;
  for (;;) {
    const b = await Booking.findOneAndUpdate(
      { "schedule.date": tomorrow, status: { $in: ["Confirmed", "Assigned"] }, "emails.reminderAt": null },
      { $set: { "emails.reminderAt": now } },
      { new: true },
    );
    if (!b) break;
    await mailer.send({ to: b.customer.email, ref: b.bookingId, ...emails.reminder(b) });
    if (sms && text.enabled && text.dayBeforeReminder && b.customer.phone) {
      await sms.send(b.customer.phone, fill(text.templates.reminder, { firstName: b.customer.firstName || "there", date: formatLagosDate(b.schedule.date), time: formatTime(b.schedule.time), ref: b.bookingId }));
    }
    sent++;
  }
  return sent;
}

module.exports = { sendDueReminders };
