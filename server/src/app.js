// Builds the Express app. Kept separate from index.js so tests can create it without a real server.
const express = require("express");
const cors = require("cors");
const { makeAuth } = require("./middleware/auth");
const { makeLimiters } = require("./middleware/rateLimit");
const { notFoundHandler, makeErrorHandler } = require("./middleware/errors");
const { createMailer } = require("./lib/email");
const { createSms } = require("./lib/sms");
const { createPaystack } = require("./lib/paystack");
const { bookingEmails } = require("./lib/bookingEmails");
const { createPaymentConfirmer } = require("./lib/bookingPayments");

function createApp(config, deps = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind nginx on the VPS

  const ctx = {
    config,
    auth: makeAuth(config),
    limiters: makeLimiters(),
    mailer: deps.mailer || createMailer(config),
    sms: deps.sms || createSms(config),
    fetchImpl: deps.fetchImpl || globalThis.fetch,
  };
  ctx.paystack = deps.paystack || createPaystack(config, ctx.fetchImpl);
  ctx.emails = bookingEmails(config);
  ctx.confirmPayment = createPaymentConfirmer(ctx);
  app.locals.ctx = ctx;

  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("X-Frame-Options", "DENY");
    next();
  });

  const allowed = new Set([config.frontendUrl]);
  if (!config.isProduction) ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"].forEach((o) => allowed.add(o));
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowed.has(origin)), credentials: false }));

  // Paystack signs the raw body, so the webhook must see it unparsed (registered before express.json).
  app.use("/api/payments/paystack/webhook", express.raw({ type: "*/*", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", require("./routes/auth")(ctx));
  app.use("/api/services", require("./routes/services")(ctx));
  app.use("/api/bookings", require("./routes/bookings")(ctx));
  app.use("/api/payments", require("./routes/payments")(ctx));
  app.use("/api/quotes", require("./routes/quotes")(ctx));
  app.use("/api/applicants", require("./routes/applicants")(ctx));
  app.use("/api/admin", require("./routes/admin")(ctx));

  app.use("/api", notFoundHandler);
  app.use(notFoundHandler);
  app.use(makeErrorHandler(config));
  return app;
}

module.exports = { createApp };
