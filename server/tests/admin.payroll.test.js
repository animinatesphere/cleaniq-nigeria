// Monthly payroll: cleaners are paid once a month — salary, or per-job pay for jobs finished that
// month (Lagos time) — plus bonuses / minus deductions; paid by Paystack Transfer or marked paid; never twice.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const Worker = require("../src/models/Worker");
const Booking = require("../src/models/Booking");
const Withdrawal = require("../src/models/Withdrawal");

const paystack = fakePaystack();
let t, owner, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  paystack.reset();
  owner = await t.adminToken("owner");
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

const bank = { bankName: "GTBank", bankCode: "058", accountNumber: "0123456789", accountName: "X" };
const job = (id, w, finishedAt, amount) => ({ bookingId: id, service: "Deep Cleaning", assignedWorker: w._id, status: "Completed", job: { finishedAt: new Date(finishedAt) }, workerPay: { amount, status: "unpaid" }, customer: { email: "c@x.com" } });

async function setup() {
  const perJob = await Worker.create({ firstName: "Ada", lastName: "Obi", email: "ada@cleaniq.test", passwordHash: "x", pay: { type: "perJob", perJobRate: 5000 }, bank });
  const salaried = await Worker.create({ firstName: "Bayo", lastName: "Ade", email: "bayo@cleaniq.test", passwordHash: "x", pay: { type: "salary", monthlySalary: 120000 }, bank });
  await Booking.create([
    job("NG-1", perJob, "2026-10-02T10:00:00Z", 5000),
    job("NG-2", perJob, "2026-10-31T22:30:00Z", 5000), // 31 Oct 23:30 Lagos → October
    job("NG-3", perJob, "2026-10-31T23:30:00Z", 5000), // 1 Nov 00:30 Lagos → November
    job("NG-4", salaried, "2026-10-10T10:00:00Z", 0),
  ]);
  return { perJob, salaried };
}
const row = (r, w) => r.body.items.find((x) => x.workerId === String(w._id));

test("payroll for a month: per-job sums jobs finished that month (Lagos), salary cleaners get their salary", async () => {
  const { perJob, salaried } = await setup();
  const r = await t.api("GET", "/api/admin/staff-pay/payroll?month=2026-10", { token: manager });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(row(r, perJob).jobsCount, 2);
  assert.equal(row(r, perJob).total, 10000);
  assert.equal(row(r, salaried).total, 120000);
  assert.equal(row(r, salaried).jobsCount, 1);
  assert.equal(r.body.totals.total, 130000);
  const nov = await t.api("GET", "/api/admin/staff-pay/payroll?month=2026-11", { token: manager });
  assert.equal(row(nov, perJob).total, 5000);
  assert.equal((await t.api("GET", "/api/admin/staff-pay/payroll?month=2026-10", { token: staff })).status, 403);
});

test("bonuses and deductions change the total", async () => {
  const { perJob } = await setup();
  const add = (amount, note) => t.api("POST", "/api/admin/staff-pay/payroll/2026-10/adjustments", { token: manager, body: { workerId: perJob._id, amount, note } });
  assert.equal((await add(2500, "Great reviews")).status, 201);
  assert.equal((await add(-1000, "Late twice")).status, 201);
  assert.equal((await add(0, "")).status, 400);
  const r = await t.api("GET", "/api/admin/staff-pay/payroll?month=2026-10", { token: manager });
  assert.equal(row(r, perJob).adjustmentsTotal, 1500);
  assert.equal(row(r, perJob).total, 11500);
});

test("pay by Paystack Transfer (owner only), once per cleaner per month; jobs marked processing", async () => {
  const { perJob } = await setup();
  assert.equal((await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: manager, body: { workerId: perJob._id } })).status, 403);
  const r = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: owner, body: { workerId: perJob._id } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.payment.amount, 10000);
  assert.equal(r.body.payment.status, "Processing");
  assert.ok(paystack.calls.some((c) => c.name === "transfer" && c.args.amountKobo === 1000000));
  assert.equal((await Booking.findOne({ bookingId: "NG-1" })).workerPay.status, "processing");
  const again = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: owner, body: { workerId: perJob._id } });
  assert.equal(again.status, 409);
  const adj = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/adjustments", { token: manager, body: { workerId: perJob._id, amount: 500, note: "Too late" } });
  assert.equal(adj.status, 400, "can't change a month already paid");
});

test("mark paid by cash/bank transfer; a failed Paystack transfer frees the month to try again", async () => {
  const { perJob, salaried } = await setup();
  const cash = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: owner, body: { workerId: salaried._id, method: "cash", note: "Paid in office" } });
  assert.equal(cash.status, 201);
  assert.equal(cash.body.payment.status, "Paid");
  assert.equal((await Booking.findOne({ bookingId: "NG-4" })).workerPay.status, "paid");

  paystack.failNext = "transfer";
  const failed = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: owner, body: { workerId: perJob._id } });
  assert.ok(failed.status >= 400);
  assert.equal(await Withdrawal.countDocuments({ payrollKey: `${perJob._id}:2026-10` }), 0);
  const retry = await t.api("POST", "/api/admin/staff-pay/payroll/2026-10/pay", { token: owner, body: { workerId: perJob._id } });
  assert.equal(retry.status, 201);
});

test("payday setting", async () => {
  assert.equal((await t.api("PUT", "/api/admin/settings/payroll", { token: manager, body: { payday: 31 } })).status, 400);
  assert.equal((await t.api("PUT", "/api/admin/settings/payroll", { token: manager, body: { payday: 25 } })).status, 200);
  assert.equal((await t.api("GET", "/api/admin/settings", { token: manager })).body.payroll.payday, 25);
});
