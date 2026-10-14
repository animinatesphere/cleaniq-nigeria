// What a cleaner earns for one completed job. Cleaners on a monthly salary earn nothing extra per job;
// cleaners paid per job earn their per-job rate. Both are paid once a month on payday (admin → Staff pay).
const Worker = require("../models/Worker");
const { round2 } = require("./money");

async function workerPayFor(booking) {
  if (!booking.assignedWorker) return 0;
  const w = await Worker.findById(booking.assignedWorker).select("pay").lean();
  if (w?.pay?.type !== "perJob") return 0;
  return round2(w.pay.perJobRate || 0);
}

module.exports = { workerPayFor };
