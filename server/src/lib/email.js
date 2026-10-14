// Sends email through Resend and records every attempt in EmailLog (admin → Email history).
// Tests use an in-memory outbox; development without RESEND_API_KEY logs the email instead of sending.
const EmailLog = require("../models/EmailLog");
const { escapeHtml } = require("./text");

const outbox = []; // test transport

function createMailer(config, { fetchImpl = globalThis.fetch } = {}) {
  async function send({ to, subject, html, type = "", ref = "" }) {
    if (!to) return { status: "skipped" };
    let status = "sent";
    let providerId;
    let error;
    try {
      if (config.isTest) {
        outbox.push({ to, subject, html, type, ref });
      } else if (!config.resendApiKey) {
        status = "skipped";
        console.log(`[email not sent — RESEND_API_KEY missing] to=${to} subject="${subject}"`);
      } else {
        const res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || `Resend error ${res.status}`);
        providerId = body.id;
      }
    } catch (e) {
      status = "failed";
      error = e.message;
      console.error(`Email to ${to} failed: ${e.message}`);
    }
    await EmailLog.create({ to, subject, type, ref, status, providerId, error }).catch(() => {});
    return { status, error };
  }
  return { send };
}

// ── Branded layout (green, like the website) ────────────────────────────────────────────────
function layout(config, { title, intro = "", bodyHtml = "", button }) {
  const logo = `${config.frontendUrl}/email-logo.png`;
  const btn = button
    ? `<p style="margin:28px 0 8px;text-align:center"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#036847;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${escapeHtml(button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f9f5;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f9f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#036847;padding:22px 28px"><img src="${logo}" alt="Cleaniq Services" height="44" style="display:block;height:44px"></td></tr>
<tr><td style="padding:32px 28px">
<h1 style="margin:0 0 12px;font-size:22px;color:#061a13">${escapeHtml(title)}</h1>
${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">${intro}</p>` : ""}
${bodyHtml}${btn}
</td></tr>
<tr><td style="background:#061a13;color:#a7f3d0;padding:18px 28px;font-size:12px;line-height:1.6">
Cleaniq Nigeria · Professional cleaning across Lagos<br>
<a href="${config.frontendUrl}" style="color:#6ee7b7">${escapeHtml(config.frontendUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr></table></td></tr></table></body></html>`;
}

// A two-column details table: rows = [[label, value], …]. Values are escaped.
function detailsTable(rows) {
  const tr = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:42%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#061a13">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:8px 0">${tr}</table>`;
}

module.exports = { createMailer, layout, detailsTable, outbox };
