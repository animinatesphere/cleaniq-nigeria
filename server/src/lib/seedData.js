// Starter Nigeria price list (naira, per clean). Placeholders for the owner to review in admin → Price list.
const Service = require("../models/Service");
const { SIZE_PROPERTY_TYPES } = require("./lagos");

const round500 = (n) => Math.round(n / 500) * 500;

// Builds a price table: base[bedrooms] for flats, other property types scaled; null = priced by quote.
function grid(base, hours, { duplexFrom = 2, mansionFrom = 4 } = {}) {
  const scale = { Flat: 1, Terrace: 1.1, Bungalow: 1.1, Duplex: 1.35, Mansion: 1.8 };
  const extraHours = { Flat: 0, Terrace: 0.5, Bungalow: 0.5, Duplex: 1, Mansion: 2 };
  const rows = [];
  for (const type of SIZE_PROPERTY_TYPES) {
    for (let bed = 0; bed <= 6; bed++) {
      if (type === "Duplex" && bed < duplexFrom) continue;
      if (type === "Mansion" && bed < mansionFrom) continue;
      if (type !== "Flat" && bed === 0) continue;
      rows.push({ propertyType: type, bedrooms: bed, price: round500(base[bed] * scale[type]), estHours: hours[bed] + extraHours[type] });
    }
  }
  return rows;
}

const STARTER_SERVICES = [
  {
    name: "Regular Cleaning", slug: "regular-cleaning", category: "Base", pricing: "size", sortOrder: 1, extraBathroomPrice: 3000,
    description: "Routine upkeep — dusting, floors, kitchen and bathrooms.",
    sizePrices: grid([10000, 15000, 20000, 25000, 32000, 40000, 48000], [2, 2.5, 3, 4, 5, 6, 7]),
  },
  {
    name: "Deep Cleaning", slug: "deep-cleaning", category: "Base", pricing: "size", sortOrder: 2, extraBathroomPrice: 6000,
    description: "Top-to-bottom clean including inside cabinets, grout and behind furniture.",
    sizePrices: grid([20000, 30000, 40000, 50000, 65000, 80000, 95000], [4, 5, 6, 7, 9, 11, 13]),
  },
  {
    name: "Post-Construction Cleaning", slug: "post-construction-cleaning", category: "Base", pricing: "quote", sortOrder: 3,
    description: "Dust, paint and cement splashes cleared after building or renovation. Priced per job after a quick look.",
  },
  { name: "Carpet Cleaning", slug: "carpet-cleaning", category: "Base", pricing: "fixed", rate: 8000, unitLabel: "carpet", sortOrder: 4, description: "Deep shampoo for carpets and rugs." },
  {
    name: "Oven Cleaning", slug: "oven-cleaning", category: "Base", pricing: "fixed", rate: 15000, unitLabel: "oven", sortOrder: 5,
    options: [{ label: "Single oven", rate: 15000 }, { label: "Double oven", rate: 22000 }, { label: "Range cooker", rate: 30000 }],
    description: "Degreasing inside and out, racks and trays.",
  },

  { name: "Inside oven", slug: "extra-inside-oven", category: "Extras", rate: 10000, unitLabel: "oven", sortOrder: 10 },
  { name: "Inside fridge", slug: "extra-inside-fridge", category: "Extras", rate: 7500, unitLabel: "fridge", sortOrder: 11 },
  { name: "Inside cabinets", slug: "extra-inside-cabinets", category: "Extras", rate: 6000, unitLabel: "kitchen", sortOrder: 12 },
  { name: "Carpet or rug shampoo", slug: "extra-carpet", category: "Extras", rate: 8000, unitLabel: "carpet", sortOrder: 13 },
  { name: "Inside windows", slug: "extra-windows", category: "Extras", rate: 2500, unitLabel: "room", sortOrder: 14 },
  { name: "Laundry", slug: "extra-laundry", category: "Extras", rate: 5000, unitLabel: "load", sortOrder: 15 },
  { name: "Ironing", slug: "extra-ironing", category: "Extras", rate: 4000, unitLabel: "load", sortOrder: 16 },
  { name: "Balcony or terrace", slug: "extra-balcony", category: "Extras", rate: 4000, unitLabel: "balcony", sortOrder: 17 },
];

// Adds the starter list only when the price list is empty. Returns how many were added.
async function seedServices() {
  if (await Service.estimatedDocumentCount()) return 0;
  await Service.insertMany(STARTER_SERVICES);
  return STARTER_SERVICES.length;
}

module.exports = { STARTER_SERVICES, seedServices };
