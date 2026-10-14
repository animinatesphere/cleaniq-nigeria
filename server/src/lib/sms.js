// SMS through Termii (Nigerian provider). Used for reminders later; logs instead of sending when not configured.
function createSms(config, { fetchImpl = globalThis.fetch } = {}) {
  async function send(to, message) {
    if (!to) return { status: "skipped" };
    if (config.isTest || !config.termiiApiKey) {
      if (!config.isTest) console.log(`[sms not sent — TERMII_API_KEY missing] to=${to}`);
      return { status: "skipped" };
    }
    try {
      const res = await fetchImpl("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: config.termiiApiKey, to: to.replace(/^\+/, ""), from: "Cleaniq", sms: message, type: "plain", channel: "generic" }),
      });
      if (!res.ok) throw new Error(`Termii error ${res.status}`);
      return { status: "sent" };
    } catch (e) {
      console.error(`SMS to ${to} failed: ${e.message}`);
      return { status: "failed", error: e.message };
    }
  }
  return { send };
}

module.exports = { createSms };
