// Paystack webhook. The only (with server-side verify) way a booking becomes paid.
const express = require("express");
const { isValidSignature } = require("../lib/paystack");

module.exports = function paymentRoutes({ config, confirmPayment }) {
  const router = express.Router();

  router.post("/paystack/webhook", async (req, res) => {
    const raw = req.body; // Buffer (express.raw in app.js)
    if (!isValidSignature(raw, req.get("x-paystack-signature"), config.paystackSecretKey)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    let event;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    if (event?.event === "charge.success" && event.data?.status === "success") {
      await confirmPayment(event.data);
    }
    // Always 200 for a genuine Paystack call, otherwise it keeps retrying.
    res.json({ received: true });
  });

  return router;
};
