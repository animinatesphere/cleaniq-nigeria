// Display helpers. Prices always come from the server; these only format them.
export const naira = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "Thursday 15 October 2026" from "2026-10-15"
export function longDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return "";
  const d = new Date(`${s}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "8:30am" from "08:30"
export function time12(s) {
  if (!/^\d{2}:\d{2}$/.test(s || "")) return "";
  const [h, m] = s.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

export { MONTHS, DAYS };
