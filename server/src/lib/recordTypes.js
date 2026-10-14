// Admin pages that are lists of simple records (tasks, complaints, contracts, checklists, coupons …).
// Each type is described once here: its fields, statuses and who can change it. The server checks every
// field against this (the admin's pages are drawn from the same description via GET /admin/c/types).
const { clean, isEmail, normaliseEmail, normaliseNgPhone } = require("./text");
const { isValidDate } = require("./time");
const { round2 } = require("./money");

const MANAGERS = ["owner", "manager"];
const EVERYONE = ["owner", "manager", "staff"];

const TYPES = {
  todo: {
    label: "To-do list", singular: "To-do", titleField: "title", statusField: "status", statuses: ["To do", "Done"],
    fields: [
      { key: "title", label: "To-do", type: "text", required: true },
      { key: "due", label: "Due date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["To do", "Done"], default: "To do" },
    ],
    columns: ["title", "due", "status"], write: EVERYONE,
  },
  task: {
    label: "Tasks", singular: "Task", titleField: "title", statusField: "status", statuses: ["Open", "In progress", "Done"],
    fields: [
      { key: "title", label: "Task", type: "text", required: true },
      { key: "assignee", label: "Who", type: "text" },
      { key: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], default: "Normal" },
      { key: "due", label: "Due date", type: "date" },
      { key: "relatedRef", label: "Booking / quote / customer", type: "text" },
      { key: "details", label: "Details", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Open", "In progress", "Done"], default: "Open" },
    ],
    columns: ["title", "assignee", "priority", "due", "status"], write: EVERYONE,
  },
  complaint: {
    label: "Complaints", singular: "Complaint", titleField: "customer", statusField: "status", statuses: ["Open", "Investigating", "Re-clean booked", "Resolved"],
    fields: [
      { key: "customer", label: "Customer", type: "text", required: true },
      { key: "contact", label: "Phone or email", type: "text" },
      { key: "bookingRef", label: "Booking", type: "text" },
      { key: "category", label: "What about", type: "select", options: ["Quality of clean", "Lateness", "Damage", "Behaviour", "Missing item", "Billing", "Other"], default: "Quality of clean" },
      { key: "details", label: "What happened", type: "textarea", required: true },
      { key: "resolution", label: "What we did", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Investigating", "Re-clean booked", "Resolved"], default: "Open" },
    ],
    columns: ["customer", "bookingRef", "category", "status"], write: EVERYONE,
  },
  contract: {
    label: "Contracts", singular: "Contract", titleField: "client", statusField: "status", statuses: ["Draft", "Active", "Ended"],
    fields: [
      { key: "client", label: "Client", type: "text", required: true },
      { key: "contactName", label: "Contact person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "service", label: "Service", type: "text" },
      { key: "frequency", label: "How often", type: "select", options: ["Daily", "Weekly", "Fortnightly", "Monthly", "One-off"], default: "Weekly" },
      { key: "monthlyValue", label: "Monthly value (₦)", type: "money" },
      { key: "start", label: "Start", type: "date" },
      { key: "end", label: "End", type: "date" },
      { key: "notes", label: "Terms / notes", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Ended"], default: "Draft" },
    ],
    columns: ["client", "service", "frequency", "monthlyValue", "end", "status"], write: MANAGERS,
  },
  checklist: {
    label: "Checklist", singular: "Checklist", titleField: "name",
    fields: [
      { key: "name", label: "Checklist name", type: "text", required: true },
      { key: "service", label: "Service", type: "text" },
      { key: "items", label: "Tasks (one per line)", type: "list", required: true },
      { key: "notes", label: "Notes for the cleaner", type: "textarea" },
    ],
    columns: ["name", "service", "items"], write: MANAGERS,
  },
  coupon: {
    label: "Coupons", singular: "Coupon", titleField: "code", statusField: "status", statuses: ["Active", "Paused", "Expired"],
    fields: [
      { key: "code", label: "Code", type: "code", required: true },
      { key: "kind", label: "Discount", type: "select", options: ["Percent", "Naira amount"], default: "Percent" },
      { key: "value", label: "Value", type: "number", required: true },
      { key: "validFrom", label: "Valid from", type: "date" },
      { key: "validTo", label: "Valid until", type: "date" },
      { key: "maxUses", label: "Max uses (empty = no limit)", type: "number" },
      { key: "note", label: "Note", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Paused", "Expired"], default: "Active" },
    ],
    columns: ["code", "kind", "value", "validTo", "status"], write: MANAGERS, unique: "code",
  },
  referral: {
    label: "Referrals", singular: "Referral", titleField: "referrer", statusField: "status", statuses: ["Invited", "Booked", "Rewarded"],
    fields: [
      { key: "referrer", label: "Referred by (customer)", type: "text", required: true },
      { key: "referrerContact", label: "Their phone or email", type: "text" },
      { key: "friend", label: "Friend", type: "text", required: true },
      { key: "friendContact", label: "Friend's phone or email", type: "text" },
      { key: "bookingRef", label: "Friend's booking", type: "text" },
      { key: "reward", label: "Reward (₦)", type: "money" },
      { key: "status", label: "Status", type: "select", options: ["Invited", "Booked", "Rewarded"], default: "Invited" },
    ],
    columns: ["referrer", "friend", "bookingRef", "reward", "status"], write: EVERYONE,
  },
  creator: {
    label: "Commission", singular: "Creator", titleField: "name", statusField: "status", statuses: ["Active", "Paused"],
    fields: [
      { key: "name", label: "Creator / influencer", type: "text", required: true },
      { key: "code", label: "Their code", type: "code", required: true },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "percent", label: "Commission %", type: "number", required: true, min: 0, max: 100 },
      { key: "bank", label: "Bank account for payouts", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Paused"], default: "Active" },
    ],
    columns: ["name", "code", "percent", "status"], write: MANAGERS, unique: "code",
  },
  commercial: {
    label: "Commercial hub", singular: "Business client", titleField: "company", statusField: "status", statuses: ["Prospect", "Client", "Former"],
    fields: [
      { key: "company", label: "Company", type: "text", required: true },
      { key: "industry", label: "Type", type: "select", options: ["Office", "Estate / facility", "Hotel / short-let", "School", "Hospital / clinic", "Retail", "Church / mosque", "Other"], default: "Office" },
      { key: "contactName", label: "Contact person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "sites", label: "Sites / addresses (one per line)", type: "list" },
      { key: "monthlyValue", label: "Monthly value (₦)", type: "money" },
      { key: "notes", label: "Notes", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["Prospect", "Client", "Former"], default: "Prospect" },
    ],
    columns: ["company", "industry", "contactName", "monthlyValue", "status"], write: MANAGERS,
  },
  propertyReport: {
    label: "Property report", singular: "Property report", titleField: "address", statusField: "overall", statuses: ["Good", "Fair", "Poor"],
    fields: [
      { key: "address", label: "Property", type: "text", required: true },
      { key: "bookingRef", label: "Booking", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "inspector", label: "Checked by", type: "text" },
      { key: "rooms", label: "Rooms checked (one per line, e.g. Kitchen — spotless)", type: "list" },
      { key: "overall", label: "Overall", type: "select", options: ["Good", "Fair", "Poor"], default: "Good" },
      { key: "photos", label: "Photo links (one per line)", type: "list" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    columns: ["address", "bookingRef", "date", "inspector", "overall"], write: EVERYONE,
  },
  propertyCondition: {
    label: "Property condition", singular: "Condition record", titleField: "address", statusField: "damage", statuses: ["No damage", "Damage found"],
    fields: [
      { key: "address", label: "Property", type: "text", required: true },
      { key: "bookingRef", label: "Booking", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "before", label: "Condition before the clean", type: "textarea" },
      { key: "after", label: "Condition after the clean", type: "textarea" },
      { key: "damage", label: "Damage", type: "select", options: ["No damage", "Damage found"], default: "No damage" },
      { key: "photos", label: "Photo links (one per line)", type: "list" },
    ],
    columns: ["address", "bookingRef", "date", "damage"], write: EVERYONE,
  },
  guide: {
    label: "Send guides", singular: "Guide", titleField: "title", statusField: "status", statuses: ["Draft", "Sent"],
    fields: [
      { key: "title", label: "Guide title", type: "text", required: true },
      { key: "link", label: "Link to the guide (PDF or page)", type: "url", required: true },
      { key: "message", label: "Message with it", type: "textarea" },
      { key: "audience", label: "Send to", type: "select", options: ["All customers", "All cleaners", "All leads", "These emails"], default: "All customers" },
      { key: "emails", label: "Emails (one per line, for 'These emails')", type: "list" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent"], default: "Draft", readOnly: true },
    ],
    columns: ["title", "audience", "status"], write: MANAGERS, send: "guide",
  },
  orgMember: {
    label: "Organisation chart", singular: "Team member", titleField: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "role", label: "Job title", type: "text", required: true },
      { key: "department", label: "Team", type: "select", options: ["Management", "Operations", "Cleaning", "Customer care", "Sales & marketing", "Finance"], default: "Operations" },
      { key: "reportsTo", label: "Reports to (name)", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
    ],
    columns: ["name", "role", "department", "reportsTo"], write: MANAGERS,
  },
  campaign: {
    label: "Campaigns", singular: "Campaign", titleField: "name", statusField: "status", statuses: ["Draft", "Sent"],
    fields: [
      { key: "name", label: "Campaign name", type: "text", required: true },
      { key: "subject", label: "Email subject", type: "text", required: true },
      { key: "audience", label: "Send to", type: "select", options: ["All customers", "All leads", "New leads", "Quoted leads", "Lost leads", "These emails"], default: "All customers" },
      { key: "emails", label: "Emails (one per line, for 'These emails')", type: "list" },
      { key: "body", label: "Message", type: "textarea", required: true },
      { key: "buttonText", label: "Button text (optional)", type: "text" },
      { key: "buttonLink", label: "Button link (optional)", type: "url" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent"], default: "Draft", readOnly: true },
    ],
    columns: ["name", "audience", "status"], write: MANAGERS, send: "campaign",
  },
  coldEmail: {
    label: "Cold email", singular: "Cold email", titleField: "name", statusField: "status", statuses: ["Draft", "Sent"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "subject", label: "Email subject", type: "text", required: true },
      { key: "emails", label: "Prospects' emails (one per line)", type: "list", required: true },
      { key: "body", label: "Message", type: "textarea", required: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent"], default: "Draft", readOnly: true },
    ],
    columns: ["name", "emails", "status"], write: MANAGERS, send: "coldEmail",
  },
  knowledge: {
    label: "AI knowledge", singular: "Answer", titleField: "question",
    fields: [
      { key: "question", label: "Question or topic", type: "text", required: true },
      { key: "answer", label: "What the receptionist should say", type: "textarea", required: true },
      { key: "category", label: "Category", type: "select", options: ["Prices", "Services", "Areas", "Booking & payment", "Policies", "Other"], default: "Other" },
    ],
    columns: ["question", "category"], write: MANAGERS,
  },
};

const MAX = { text: 200, textarea: 5000, url: 500, code: 20, list: 100 };

/** Checks input for a type. Returns { data, title, status, errors }. `partial` = only given fields (PATCH). */
function cleanRecord(type, input = {}, { partial = false } = {}) {
  const def = TYPES[type];
  const data = {};
  const errors = {};
  for (const f of def.fields) {
    if (partial && !(f.key in input)) continue;
    if (f.readOnly && !partial) {
      if (f.default !== undefined) data[f.key] = f.default;
      continue;
    }
    if (f.readOnly) continue;
    const raw = input[f.key];
    const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && !raw.length);
    if (empty) {
      if (f.required) errors[f.key] = `Enter ${f.label.toLowerCase()}`;
      else data[f.key] = f.type === "list" ? [] : f.default ?? (f.type === "boolean" ? false : "");
      continue;
    }
    switch (f.type) {
      case "text": data[f.key] = clean(raw, MAX.text); break;
      case "textarea": data[f.key] = String(raw).replace(/<[^>]*>?/g, "").trim().slice(0, MAX.textarea); break;
      case "code": {
        const c = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX.code);
        if (c.length < 3) errors[f.key] = "Use 3–20 letters or numbers";
        data[f.key] = c;
        break;
      }
      case "url": {
        const u = String(raw).trim().slice(0, MAX.url);
        if (!/^https?:\/\/\S+$/i.test(u)) errors[f.key] = "Enter a full link starting with https://";
        data[f.key] = u;
        break;
      }
      case "email": {
        const e = normaliseEmail(raw);
        if (!isEmail(e)) errors[f.key] = "Enter a valid email";
        data[f.key] = e;
        break;
      }
      case "phone": {
        const p = normaliseNgPhone(raw);
        if (!p) errors[f.key] = "Enter a Nigerian phone number";
        data[f.key] = p;
        break;
      }
      case "date":
        if (!isValidDate(raw)) errors[f.key] = "Choose a date";
        data[f.key] = String(raw);
        break;
      case "number":
      case "money": {
        const n = Number(raw);
        const min = f.min ?? 0;
        const max = f.max ?? 1_000_000_000;
        if (!Number.isFinite(n) || n < min || n > max) errors[f.key] = `Enter a number from ${min} to ${max}`;
        data[f.key] = f.type === "money" ? round2(n) : n;
        break;
      }
      case "select":
        if (!f.options.includes(raw)) errors[f.key] = `Choose: ${f.options.join(", ")}`;
        data[f.key] = raw;
        break;
      case "boolean": data[f.key] = Boolean(raw); break;
      case "list": {
        const items = (Array.isArray(raw) ? raw : String(raw).split(/\r?\n/)).map((x) => clean(x, MAX.text)).filter(Boolean).slice(0, f.max || MAX.list);
        if (f.required && !items.length) errors[f.key] = `Add at least one line`;
        data[f.key] = items;
        break;
      }
      default: break;
    }
  }
  const title = data[def.titleField] !== undefined ? String(Array.isArray(data[def.titleField]) ? data[def.titleField].join(", ") : data[def.titleField]) : undefined;
  const status = def.statusField && data[def.statusField] !== undefined ? String(data[def.statusField]) : undefined;
  return { data, title, status, errors };
}

/** What the admin pages need to draw each type (no server-only details). */
function publicTypes() {
  return Object.fromEntries(Object.entries(TYPES).map(([k, d]) => [k, {
    label: d.label, singular: d.singular, titleField: d.titleField, statusField: d.statusField || null, statuses: d.statuses || [],
    fields: d.fields, columns: d.columns, write: d.write, canSend: Boolean(d.send),
  }]));
}

module.exports = { TYPES, cleanRecord, publicTypes, MANAGERS, EVERYONE };
