// Automation switches (admin → Automations / SMS automation / AI receptionist), with safe defaults.
const { getSetting } = require("./settings");

const AUTOMATIONS = {
  dayBeforeReminder: true, // email the day before the clean
  payAfterInvoice: true, // invoice pay-after cleans when completed
  weeklyBilling: true, // weekly bill for weekly-plan customers
  subscriptionBilling: true, // monthly plan invoices on the billing date
  overdueReminders: true, // remind unpaid invoices after the due date
  blogPublishing: true, // publish scheduled posts / blog autopilot
};

const SMS = {
  enabled: false,
  dayBeforeReminder: true,
  invoiceIssued: true,
  templates: {
    reminder: "Hi {firstName}, a reminder that your Cleaniq clean is tomorrow ({date}) at {time}. Ref {ref}.",
    invoice: "Hi {firstName}, your Cleaniq invoice {ref} for {amount} is due {date}. Pay here: {link}",
  },
};

const AI = {
  enabled: false,
  names: ["Tunde", "Emeka", "Chidi", "Femi"],
  greeting: "Good day, thank you for calling Cleaniq Nigeria. How can I help you today?",
  instructions: "",
  handoverPhone: "",
  channels: { whatsapp: false, phone: false },
  saveLeads: true,
};

async function load(key, defaults) {
  const v = (await getSetting(key)) || {};
  return { ...defaults, ...v, ...(defaults.templates ? { templates: { ...defaults.templates, ...(v.templates || {}) } } : {}), ...(defaults.channels ? { channels: { ...defaults.channels, ...(v.channels || {}) } } : {}) };
}

const getAutomations = () => load("automations", AUTOMATIONS);
const getSmsSettings = () => load("smsAutomation", SMS);
const getAiSettings = () => load("aiReceptionist", AI);

const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

module.exports = { AUTOMATIONS, SMS, AI, getAutomations, getSmsSettings, getAiSettings, fill };
