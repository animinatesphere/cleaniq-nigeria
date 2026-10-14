// The automatic jobs (run from index.js on a timer). Each one is switched on/off in admin → Automations
// and is safe to run on overlapping ticks (every send / bill is claimed atomically).
const { getAutomations } = require("../lib/automations");
const { runWeeklyBilling, runSubscriptionBilling, sendOverdueReminders } = require("../lib/invoices");
const { publishDuePosts, runAutopilot } = require("../lib/blog");
const { sendDueReminders } = require("./reminders");

async function runReminders(ctx) {
  const a = await getAutomations();
  return a.dayBeforeReminder ? sendDueReminders(ctx) : 0;
}

async function runBilling(ctx) {
  const a = await getAutomations();
  const out = {};
  if (a.subscriptionBilling) out.plans = await runSubscriptionBilling(ctx);
  if (a.weeklyBilling) out.weekly = await runWeeklyBilling(ctx);
  if (a.overdueReminders) out.overdue = await sendOverdueReminders(ctx);
  return out;
}

async function runBlog(ctx) {
  const a = await getAutomations();
  if (!a.blogPublishing) return 0;
  const n = await publishDuePosts();
  await runAutopilot(ctx);
  return n;
}

module.exports = { runReminders, runBilling, runBlog };
