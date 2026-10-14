// Checks the booking form on the server (the website checks too, but the server is the one that counts).
// Returns { data, errors } — errors are keyed by form field with plain-English messages.
const { clean, normaliseEmail, isEmail, normaliseNgPhone } = require("./text");
const { isValidDate, lagosDate, addDays } = require("./time");
const { LAGOS_AREAS, PROPERTY_TYPES, PARKING_OPTIONS, ACCESS_OPTIONS, TIME_SLOTS, MAX_DAYS_AHEAD } = require("./lagos");

const NAME_RE = /^[\p{L}][\p{L}\s'.-]{1,49}$/u;

function count(v) {
  const n = Number(v ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : NaN;
}

// admin: staff booking over the phone — today is allowed and property/access details are optional.
function validateBookingInput(body = {}, now = new Date(), { admin = false } = {}) {
  const errors = {};
  const data = {};

  // Step 1 — location
  data.area = clean(body.area, 60);
  if (!LAGOS_AREAS.includes(data.area)) errors.area = "Please choose your area in Lagos";
  data.address = clean(body.address, 200);
  if (data.address.length < 5) errors.address = "Please enter your full address";
  data.landmark = clean(body.landmark, 100);

  // Step 2 — property
  data.propertyType = clean(body.propertyType, 30);
  if (!PROPERTY_TYPES.includes(data.propertyType) && !(admin && !data.propertyType)) errors.propertyType = "Please choose your property type";
  data.rooms = {};
  for (const k of ["bedrooms", "bathrooms", "kitchens", "livingRooms", "stairs"]) {
    data.rooms[k] = count(body[k]);
    if (Number.isNaN(data.rooms[k])) errors[k] = "Please enter a number between 0 and 20";
  }
  const rooms = ["bedrooms", "bathrooms", "kitchens", "livingRooms"].reduce((s, k) => s + (data.rooms[k] || 0), 0);
  if (!Object.keys(errors).some((k) => k in data.rooms) && rooms < 1 && !admin) errors.rooms = "Please add at least one room to clean";
  if (typeof body.pets !== "boolean" && !admin) errors.pets = "Please let us know if you have pets";
  data.pets = body.pets === true;

  // Step 3 — access
  data.parking = clean(body.parking, 60);
  if (!PARKING_OPTIONS.includes(data.parking) && !(admin && !data.parking)) errors.parking = "Please tell us about parking";
  data.access = clean(body.access, 60);
  if (!ACCESS_OPTIONS.includes(data.access) && !(admin && !data.access)) errors.access = "Please tell us how the cleaner gets in";
  data.instructions = clean(body.instructions, 1000);

  // Step 4 — date, time, details
  data.date = String(body.date || "");
  const tomorrow = addDays(lagosDate(now), admin ? 0 : 1);
  const lastDay = addDays(lagosDate(now), MAX_DAYS_AHEAD);
  if (!isValidDate(data.date) || data.date < tomorrow) errors.date = admin ? "Please choose today or a later date" : "Please choose a date from tomorrow onwards";
  else if (data.date > lastDay) errors.date = `Please choose a date within the next ${MAX_DAYS_AHEAD} days`;
  data.time = String(body.time || "");
  if (!TIME_SLOTS.includes(data.time)) errors.time = "Please choose an arrival time between 8am and 6pm";

  data.firstName = clean(body.firstName, 50);
  if (!NAME_RE.test(data.firstName)) errors.firstName = "Please enter your first name";
  data.lastName = clean(body.lastName, 50);
  if (!NAME_RE.test(data.lastName)) errors.lastName = "Please enter your last name";
  data.email = normaliseEmail(body.email);
  if (!isEmail(data.email)) errors.email = "Please enter a valid email address";
  data.phone = normaliseNgPhone(body.phone);
  if (!data.phone) errors.phone = "Please enter a Nigerian mobile number, e.g. 0803 123 4567";

  return { data, errors };
}

module.exports = { validateBookingInput };
