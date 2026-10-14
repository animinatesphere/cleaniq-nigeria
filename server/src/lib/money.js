// Money is naira with 2 decimals. Round once, at the end of each calculation step.

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// Paystack works in kobo (1 naira = 100 kobo), always a whole number.
const toKobo = (naira) => Math.round(round2(naira) * 100);
const fromKobo = (kobo) => round2(Number(kobo) / 100);

// "₦12,500.00"
function formatNaira(n) {
  return `₦${round2(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { round2, toKobo, fromKobo, formatNaira };
