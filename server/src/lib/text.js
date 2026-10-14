// Cleaning up text people type, before it's stored or put into an email.

// Removes HTML tags and control characters, collapses whitespace, trims, and caps the length.
function clean(value, max = 500) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/<[^>]*>?/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

// Escapes text for safe use inside HTML emails.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normaliseEmail = (e) => clean(e, 254).toLowerCase();
const isEmail = (e) => EMAIL_RE.test(String(e || ""));

// Nigerian mobile numbers → "+234XXXXXXXXXX" (10 digits after 234). Accepts 0803…, 803…, 234803…, +234 803 ….
function normaliseNgPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  let local;
  if (digits.startsWith("234")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  if (!/^[789][01]\d{8}$/.test(local)) return null;
  return `+234${local}`;
}

module.exports = { clean, escapeHtml, normaliseEmail, isEmail, normaliseNgPhone };
