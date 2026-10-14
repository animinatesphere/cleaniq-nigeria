// Business settings stored in SystemSetting, with safe defaults.
const SystemSetting = require("../models/SystemSetting");

const DEFAULTS = {
  vat: { enabled: false, rate: 7.5, label: "VAT" },
  suppliesFee: 5000, // ₦ per visit when Cleaniq brings supplies & equipment
};

function cleanVat(v = {}) {
  const rate = Number(v.rate);
  return {
    enabled: Boolean(v.enabled),
    rate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? Math.round(rate * 100) / 100 : DEFAULTS.vat.rate,
    label: String(v.label || DEFAULTS.vat.label).trim().slice(0, 20) || DEFAULTS.vat.label,
  };
}

async function getSetting(key) {
  const row = await SystemSetting.findOne({ key }).lean();
  return row ? row.value : DEFAULTS[key];
}

async function setSetting(key, value) {
  await SystemSetting.updateOne({ key }, { $set: { value } }, { upsert: true });
  return value;
}

async function getPricingSettings() {
  const [vat, fee] = await Promise.all([getSetting("vat"), getSetting("suppliesFee")]);
  const suppliesFee = Number(fee);
  return { vat: cleanVat(vat), suppliesFee: Number.isFinite(suppliesFee) && suppliesFee >= 0 ? suppliesFee : DEFAULTS.suppliesFee };
}

module.exports = { DEFAULTS, cleanVat, getSetting, setSetting, getPricingSettings };
