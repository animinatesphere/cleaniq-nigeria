// Public price list.
const express = require("express");
const Service = require("../models/Service");
const { publicService } = require("../lib/pricing");
const { getPricingSettings } = require("../lib/settings");

module.exports = function serviceRoutes() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const [services, settings] = await Promise.all([
      Service.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      getPricingSettings(),
    ]);
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      base: services.filter((s) => s.category === "Base").map(publicService),
      extras: services.filter((s) => s.category === "Extras").map(publicService),
      suppliesFee: settings.suppliesFee,
      vat: settings.vat,
      currency: "NGN",
    });
  });

  return router;
};
