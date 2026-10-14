// What a cleaner earns for a job: hourly pay × hours for hourly services, the fixed pay for flat ones.
const Service = require("../models/Service");
const { round2 } = require("./money");

async function workerPayFor(booking) {
  const service = booking.serviceSlug ? await Service.findOne({ slug: booking.serviceSlug }).lean() : null;
  if (!service) return 0;
  if (service.type === "hourly") return round2((service.workerHourlyRate || 0) * (booking.details?.duration || 0));
  return round2(service.workerPaymentRate || 0);
}

module.exports = { workerPayFor };
