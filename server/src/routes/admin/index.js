// Everything under /api/admin requires an admin login. Individual routes add role checks.
const express = require("express");

module.exports = function adminRoutes(ctx) {
  const router = express.Router();
  router.use(ctx.auth.requireAdmin());

  const workers = require("./workers")(ctx);
  const records = require("./records")(ctx);

  router.use("/dashboard", require("./dashboard")(ctx));
  router.use("/bookings", require("./bookings")(ctx));
  router.use("/customers", require("./customers")(ctx));
  router.use("/workers", workers.workers);
  router.use("/applicants", workers.applicants);
  router.use("/services", require("./services")(ctx));
  router.use("/quotes", require("./quotes")(ctx));
  router.use("/payments", ctx.auth.requireAdmin("owner", "manager"), require("./payments")(ctx));
  router.use("/staff-pay", require("./staffPay")(ctx));
  router.use("/settings", require("./settings")(ctx));
  router.use("/c", require("./collections")(ctx));
  const content = require("./content");
  const managers = ctx.auth.requireAdmin("owner", "manager");
  router.use("/invoices", require("./invoices")(ctx));
  router.use("/subscriptions", require("./subscriptions")(ctx));
  router.use("/leads", require("./leads")(ctx));
  router.use("/expenses", managers, require("./expenses")(ctx));
  router.use("/analytics", managers, require("./analytics")(ctx));
  router.use("/automations", require("./automations")(ctx));
  router.use("/blog", content.blogRoutes(ctx));
  router.use("/support", content.supportRoutes(ctx));
  router.use("/emails", records.emails);
  router.use("/bin", records.bin);
  router.use("/audit", records.audit);
  return router;
};
