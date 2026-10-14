// Lagos time helpers. Africa/Lagos is UTC+1 all year (no daylight saving), so plain offset maths is exact.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "YYYY-MM-DD" for the Lagos calendar day of an instant.
function lagosDate(instant = new Date()) {
  return new Date(instant.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

// "HH:MM" Lagos wall-clock time of an instant.
function lagosTime(instant = new Date()) {
  return new Date(instant.getTime() + LAGOS_OFFSET_MS).toISOString().slice(11, 16);
}

function isValidDate(s) {
  if (!DATE_RE.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isValidTime = (s) => TIME_RE.test(String(s));

// Add whole days to a "YYYY-MM-DD" string.
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The real instant of a Lagos date + time.
function lagosToInstant(dateStr, timeStr = "00:00") {
  return new Date(new Date(`${dateStr}T${timeStr}:00Z`).getTime() - LAGOS_OFFSET_MS);
}

// "Thursday 15 October 2026" (built by hand so it's identical on every server)
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function formatLagosDate(dateStr) {
  if (!isValidDate(dateStr)) return String(dateStr || "");
  const d = new Date(`${dateStr}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "8:30am"
function formatTime(timeStr) {
  if (!isValidTime(timeStr)) return String(timeStr || "");
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

module.exports = { lagosDate, lagosTime, isValidDate, isValidTime, addDays, lagosToInstant, formatLagosDate, formatTime, LAGOS_OFFSET_MS };
