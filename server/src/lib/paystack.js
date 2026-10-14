// Paystack API (https://paystack.com/docs/api). Amounts are in kobo.
const crypto = require("node:crypto");
const { HttpError } = require("../middleware/errors");

const BASE = "https://api.paystack.co";

function createPaystack(config, fetchImpl = globalThis.fetch) {
  async function call(method, path, body) {
    if (!config.paystackSecretKey) throw new HttpError(503, "Online payment isn't set up yet. Please contact us on WhatsApp to book.");
    let res;
    try {
      res = await fetchImpl(BASE + path, {
        method,
        headers: { Authorization: `Bearer ${config.paystackSecretKey}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new HttpError(502, "We couldn't reach the payment provider. Please try again in a moment.");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false) {
      const err = new HttpError(502, "The payment provider didn't accept the request. Please try again.");
      err.provider = json.message;
      throw err;
    }
    return json.data;
  }

  return {
    // → { authorization_url, access_code, reference }
    initialize: ({ email, amountKobo, reference, callbackUrl, metadata }) =>
      call("POST", "/transaction/initialize", { email, amount: amountKobo, currency: "NGN", reference, callback_url: callbackUrl, metadata }),
    // → transaction { status: "success" | …, amount, currency, reference, channel, paid_at }
    verify: (reference) => call("GET", `/transaction/verify/${encodeURIComponent(reference)}`),
    refund: ({ reference, amountKobo }) => call("POST", "/refund", { transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) }),
    // Cleaner payouts (Paystack Transfers)
    listBanks: () => call("GET", "/bank?country=nigeria&currency=NGN&perPage=100"),
    resolveAccount: ({ accountNumber, bankCode }) =>
      call("GET", `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`),
    createRecipient: ({ name, accountNumber, bankCode }) =>
      call("POST", "/transferrecipient", { type: "nuban", name, account_number: accountNumber, bank_code: bankCode, currency: "NGN" }),
    transfer: ({ amountKobo, recipient, reference, reason }) =>
      call("POST", "/transfer", { source: "balance", amount: amountKobo, recipient, reference, reason }),
  };
}

// Paystack signs each webhook: x-paystack-signature = HMAC-SHA512(raw body, secret key), hex.
function isValidSignature(rawBody, signature, secret) {
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();
  let given;
  try {
    given = Buffer.from(String(signature), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = { createPaystack, isValidSignature };
