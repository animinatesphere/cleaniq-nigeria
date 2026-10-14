// The four booking emails: received (with payment link), confirmed, reminder, done (with receipt).
const { layout, detailsTable } = require("./email");
const { formatNaira } = require("./money");
const { formatLagosDate, formatTime } = require("./time");
const { escapeHtml } = require("./text");

function summaryRows(b) {
  const r = b.details?.rooms || {};
  const rooms = [
    r.bedrooms && `${r.bedrooms} bedroom${r.bedrooms > 1 ? "s" : ""}`,
    r.bathrooms && `${r.bathrooms} bathroom${r.bathrooms > 1 ? "s" : ""}`,
    r.kitchens && `${r.kitchens} kitchen${r.kitchens > 1 ? "s" : ""}`,
    r.livingRooms && `${r.livingRooms} living room${r.livingRooms > 1 ? "s" : ""}`,
  ].filter(Boolean).join(", ");
  return [
    ["Booking reference", b.bookingId],
    ["Service", `${b.service}${b.details?.size ? ` · ${b.details.size}` : ""}`],
    ["Estimated time", b.details?.estHours ? `About ${b.details.estHours} hours` : ""],
    ["Date", formatLagosDate(b.schedule?.date)],
    ["Arrival time", formatTime(b.schedule?.time)],
    ["Address", [b.details?.address, b.details?.area].filter(Boolean).join(", ")],
    ["Landmark", b.details?.landmark],
    ["Property", [b.details?.propertyType, rooms].filter(Boolean).join(" · ")],
  ];
}

function priceTable(b) {
  const rows = (b.price?.lines || []).map((l) => [`${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`, formatNaira(l.amount)]);
  if (b.price?.vat?.enabled) rows.push([`${b.price.vat.label} (${b.price.vat.rate}%)`, formatNaira(b.price.vat.amount)]);
  rows.push(["Total", formatNaira(b.price?.total ?? b.payment?.amount)]);
  return detailsTable(rows);
}

function bookingEmails(config) {
  const hi = (b) => `Hi ${escapeHtml(b.customer?.firstName || "there")},`;
  return {
    received: (b) => ({
      subject: `Complete your booking ${b.bookingId} — Cleaniq`,
      type: "booking-received",
      html: layout(config, {
        title: "Almost done — please complete your payment",
        intro: `${hi(b)} thanks for booking with Cleaniq. Your booking is reserved; it's confirmed as soon as payment goes through.`,
        bodyHtml: detailsTable(summaryRows(b)) + priceTable(b),
        button: b.payment?.authorizationUrl ? { label: `Pay ${formatNaira(b.payment.amount)} securely`, url: b.payment.authorizationUrl } : undefined,
      }),
    }),
    confirmed: (b) => ({
      subject: `Booking confirmed: ${b.bookingId} — Cleaniq`,
      type: "booking-confirmed",
      html: layout(config, {
        title: "Your clean is booked ✓",
        intro: `${hi(b)} we've received your payment of <strong>${formatNaira(b.payment?.amount)}</strong> and your clean is confirmed. We'll remind you the day before.`,
        bodyHtml: detailsTable(summaryRows(b)) + `<p style="font-size:14px;color:#334155;line-height:1.6">Need to change something? Reply to this email or message us on WhatsApp, quoting <strong>${escapeHtml(b.bookingId)}</strong>.</p>`,
      }),
    }),
    reminder: (b) => ({
      subject: `Reminder: your Cleaniq clean is tomorrow at ${formatTime(b.schedule?.time)}`,
      type: "booking-reminder",
      html: layout(config, {
        title: "See you tomorrow!",
        intro: `${hi(b)} this is a reminder that your cleaner arrives <strong>${escapeHtml(formatLagosDate(b.schedule?.date))} at ${escapeHtml(formatTime(b.schedule?.time))}</strong>.`,
        bodyHtml: detailsTable(summaryRows(b)) + `<p style="font-size:14px;color:#334155;line-height:1.6">Access: ${escapeHtml(b.details?.access || "")}. If anything has changed, please let us know today.</p>`,
      }),
    }),
    completed: (b) => ({
      subject: `Your clean is done — receipt ${b.bookingId}`,
      type: "booking-completed",
      html: layout(config, {
        title: "Your clean is done ✨",
        intro: `${hi(b)} your cleaner has finished. Thank you for choosing Cleaniq! Here's your receipt.`,
        bodyHtml:
          detailsTable([["Receipt for", b.bookingId], ["Service date", formatLagosDate(b.schedule?.date)], ["Paid", b.payment?.paidAt ? new Date(b.payment.paidAt).toISOString().slice(0, 10) : ""], ["Payment reference", b.payment?.reference]]) +
          priceTable(b),
        button: { label: "Book your next clean", url: `${config.frontendUrl}/booking` },
      }),
    }),
    cancelled: (b, reason) => ({
      subject: `Booking ${b.bookingId} cancelled — Cleaniq`,
      type: "booking-cancelled",
      html: layout(config, {
        title: "Your booking has been cancelled",
        intro: `${hi(b)} your booking <strong>${escapeHtml(b.bookingId)}</strong> for ${escapeHtml(formatLagosDate(b.schedule?.date))} has been cancelled.${reason ? ` Reason: ${escapeHtml(reason)}.` : ""}`,
        bodyHtml: b.payment?.status === "Refund pending" || b.payment?.status === "Refunded"
          ? `<p style="font-size:14px;color:#334155;line-height:1.6">A refund of <strong>${formatNaira(b.payment.refund?.amount)}</strong> is on its way to your original payment method. It can take 5–10 working days to appear.</p>`
          : "",
        button: { label: "Book again", url: `${config.frontendUrl}/booking` },
      }),
    }),
    team: (b) => ({
      subject: `New paid booking ${b.bookingId}: ${b.service} on ${b.schedule?.date}`,
      type: "team-new-booking",
      html: layout(config, {
        title: `New booking ${b.bookingId}`,
        bodyHtml: detailsTable([["Customer", `${b.customer?.firstName} ${b.customer?.lastName}`], ["Phone", b.customer?.phone], ["Email", b.customer?.email], ...summaryRows(b)]) + priceTable(b),
      }),
    }),
  };
}

module.exports = { bookingEmails };
