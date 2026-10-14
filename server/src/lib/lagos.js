// Lagos areas we serve and the booking form's fixed options.
const LAGOS_AREAS = [
  "Ajah", "Badore", "Chevron", "Ikota", "Lekki Phase 1", "Lekki Phase 2", "Osapa London", "Agungi", "Jakande",
  "Oniru", "Victoria Island", "Ikoyi", "Banana Island", "Sangotedo", "Abraham Adesanya", "Awoyaya",
  "Ikeja", "Ikeja GRA", "Allen Avenue", "Opebi", "Maryland", "Magodo", "Ojodu Berger", "Omole", "Ogudu",
  "Gbagada", "Anthony", "Ilupeju", "Yaba", "Surulere", "Ebute Metta", "Festac", "Amuwo Odofin",
  "Isolo", "Ikotun", "Egbeda", "Ogba", "Agege", "Ikorodu", "Lagos Island", "Other (tell us in the address)",
];

const PROPERTY_TYPES = ["Flat", "Duplex", "Terrace", "Bungalow", "Mansion", "Office"];
const PARKING_OPTIONS = ["Parking inside the compound", "Street parking nearby", "No parking available"];
const ACCESS_OPTIONS = ["Someone will be home", "The gateman / security will let you in", "Key left with security / concierge"];

// Arrival times 8:00am–6:00pm on the half hour.
const TIME_SLOTS = [];
for (let m = 8 * 60; m <= 18 * 60; m += 30) TIME_SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

const MAX_DAYS_AHEAD = 90;

module.exports = { LAGOS_AREAS, PROPERTY_TYPES, PARKING_OPTIONS, ACCESS_OPTIONS, TIME_SLOTS, MAX_DAYS_AHEAD };
