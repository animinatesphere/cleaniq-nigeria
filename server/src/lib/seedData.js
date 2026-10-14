// Starter Nigeria price list (naira). These are placeholders for the owner to review in admin → Price list.
const Service = require("../models/Service");

const STARTER_SERVICES = [
  { name: "Regular Cleaning", slug: "regular-cleaning", category: "Base", type: "hourly", rate: 5000, weeklyRate: 4500, fortnightlyRate: 4750, monthlyRate: null, minHours: 2, sortOrder: 1,
    description: "Routine upkeep — dusting, floors, kitchen and bathrooms.", workerHourlyRate: 2500 },
  { name: "Deep Cleaning", slug: "deep-cleaning", category: "Base", type: "hourly", rate: 7000, monthlyRate: 6500, minHours: 3, sortOrder: 2,
    description: "Top-to-bottom clean including inside cabinets, grout and behind furniture.", workerHourlyRate: 3500 },
  { name: "Post-Construction Cleaning", slug: "post-construction-cleaning", category: "Base", type: "hourly", rate: 9000, minHours: 4, sortOrder: 3,
    description: "Dust, paint and cement splashes cleared after building or renovation.", workerHourlyRate: 4500 },
  { name: "Carpet Cleaning", slug: "carpet-cleaning", category: "Base", type: "flat", rate: 8000, unitLabel: "carpet", sortOrder: 4,
    description: "Deep shampoo for carpets and rugs.", workerPaymentRate: 4000 },
  { name: "Oven Cleaning", slug: "oven-cleaning", category: "Base", type: "flat", rate: 15000, unitLabel: "oven", sortOrder: 5,
    options: [{ label: "Single oven", rate: 15000 }, { label: "Double oven", rate: 22000 }, { label: "Range cooker", rate: 30000 }],
    description: "Degreasing inside and out, racks and trays.", workerPaymentRate: 7500 },

  { name: "Inside oven", slug: "extra-inside-oven", category: "Extras", type: "flat", rate: 10000, unitLabel: "oven", sortOrder: 10 },
  { name: "Inside fridge", slug: "extra-inside-fridge", category: "Extras", type: "flat", rate: 7500, unitLabel: "fridge", sortOrder: 11 },
  { name: "Inside cabinets", slug: "extra-inside-cabinets", category: "Extras", type: "flat", rate: 6000, unitLabel: "kitchen", sortOrder: 12 },
  { name: "Carpet or rug shampoo", slug: "extra-carpet", category: "Extras", type: "flat", rate: 8000, unitLabel: "carpet", sortOrder: 13 },
  { name: "Inside windows", slug: "extra-windows", category: "Extras", type: "flat", rate: 2500, unitLabel: "room", sortOrder: 14 },
  { name: "Laundry & ironing", slug: "extra-laundry", category: "Extras", type: "flat", rate: 5000, unitLabel: "load", sortOrder: 15 },
  { name: "Balcony or terrace", slug: "extra-balcony", category: "Extras", type: "flat", rate: 4000, unitLabel: "balcony", sortOrder: 16 },
];

// Adds the starter list only when the price list is empty. Returns how many were added.
async function seedServices() {
  if (await Service.estimatedDocumentCount()) return 0;
  await Service.insertMany(STARTER_SERVICES);
  return STARTER_SERVICES.length;
}

module.exports = { STARTER_SERVICES, seedServices };
