// Starts the Cleaniq Nigeria API: reads settings, connects to our own database, serves the app.
const { loadConfig } = require("./config");
const { connectDb } = require("./lib/db");
const { createApp } = require("./app");
const { runReminders, runBilling, runBlog } = require("./jobs/scheduled");

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`\n✖ ${e.message}\n`);
    process.exit(1);
  }
  await connectDb(config.mongoUri);
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`Cleaniq Nigeria API running on port ${config.port} (${config.nodeEnv})`);
  });

  // Schedulers (Lagos time). Each job is safe to run on overlapping ticks.
  const ctx = app.locals.ctx;
  const every = (minutes, name, fn) => {
    const run = () => fn().catch((e) => console.error(`[job ${name}]`, e.message));
    setTimeout(run, 30 * 1000);
    setInterval(run, minutes * 60 * 1000);
  };
  every(15, "reminders", () => runReminders(ctx));
  every(60, "billing", () => runBilling(ctx)); // monthly plans, weekly bills, overdue reminders
  every(10, "blog", () => runBlog(ctx)); // scheduled posts + autopilot
}

main().catch((e) => {
  console.error("Failed to start:", e.message);
  process.exit(1);
});
