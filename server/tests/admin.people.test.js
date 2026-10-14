const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const { seedServices } = require("../src/lib/seedData");
const { lagosDate, addDays } = require("../src/lib/time");
const Worker = require("../src/models/Worker");
const Booking = require("../src/models/Booking");
const Withdrawal = require("../src/models/Withdrawal");
const Customer = require("../src/models/Customer");

const paystack = fakePaystack();
let t, owner, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  paystack.reset();
  await seedServices();
  owner = await t.adminToken("owner");
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

const newWorker = (over = {}) => ({ firstName: "Amaka", lastName: "Eze", email: "amaka@cleaniq.test", phone: "0802 222 3333", areas: ["Yaba", "Surulere"], ...over });

test("cleaners: create sends a welcome email with a temporary password (stored hashed)", async () => {
  const r = await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.worker.passwordHash, undefined);
  const mail = t.outbox.find((m) => m.type === "worker-welcome");
  const pw = mail.html.match(/Temporary password<\/td><td[^>]*>([^<]+)</)[1];
  const w = await Worker.findOne({ email: "amaka@cleaniq.test" }).select("+passwordHash");
  assert.notEqual(w.passwordHash, pw);
  assert.ok(await bcrypt.compare(pw, w.passwordHash));
  assert.equal(w.mustChangePassword, true);
  const login = await t.api("POST", "/api/auth/worker/login", { body: { login: "amaka@cleaniq.test", password: pw } });
  assert.equal(login.status, 200);
  assert.equal((await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() })).status, 409, "no duplicates");
});

test("cleaners: validation, availability, suspend, reset password", async () => {
  let r = await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker({ email: "bad", phone: "1", areas: ["London"] }) });
  assert.equal(r.status, 400);
  assert.ok(r.body.details.email && r.body.details.phone && r.body.details.areas);
  const id = (await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() })).body.worker._id;
  r = await t.api("PATCH", `/api/admin/workers/${id}`, { token: manager, body: { availability: [{ day: 1, from: "08:00", to: "17:00" }] } });
  assert.equal(r.body.worker.availability.length, 1);
  r = await t.api("PATCH", `/api/admin/workers/${id}`, { token: manager, body: { availability: [{ day: 9, from: "17:00", to: "08:00" }] } });
  assert.equal(r.status, 400);
  r = await t.api("POST", `/api/admin/workers/${id}/status`, { token: manager, body: { status: "suspended" } });
  assert.equal(r.body.worker.status, "suspended");
  r = await t.api("POST", `/api/admin/workers/${id}/reset-password`, { token: manager });
  assert.equal(r.status, 200);
  assert.ok(t.outbox.some((m) => m.type === "worker-password-reset"));
});

test("cleaners: pay is a monthly salary or a rate per completed job", async () => {
  const id = (await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() })).body.worker._id;
  let r = await t.api("PATCH", `/api/admin/workers/${id}`, { token: manager, body: { pay: { type: "weekly" } } });
  assert.equal(r.status, 400);
  r = await t.api("PATCH", `/api/admin/workers/${id}`, { token: manager, body: { pay: { type: "salary", monthlySalary: 120000 } } });
  assert.equal(r.body.worker.pay.type, "salary");
  assert.equal(r.body.worker.pay.monthlySalary, 120000);
  // A salaried cleaner's completed job adds nothing per job (the salary covers it).
  const { workerPayFor } = require("../src/lib/workerPay");
  assert.equal(await workerPayFor({ assignedWorker: id }), 0);
  await t.api("PATCH", `/api/admin/workers/${id}`, { token: manager, body: { pay: { type: "perJob", perJobRate: 7000 } } });
  assert.equal(await workerPayFor({ assignedWorker: id }), 7000);
  assert.equal((await t.api("PATCH", `/api/admin/workers/${id}`, { token: staff, body: { pay: { type: "perJob", perJobRate: 1 } } })).status, 403);
});

test("cleaners: bank details checked with Paystack; staff only see last 4 digits", async () => {
  const id = (await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() })).body.worker._id;
  let r = await t.api("PATCH", `/api/admin/workers/${id}/bank`, { token: manager, body: { bankCode: "058", bankName: "GTBank", accountNumber: "12345" } });
  assert.equal(r.status, 400);
  r = await t.api("PATCH", `/api/admin/workers/${id}/bank`, { token: manager, body: { bankCode: "058", bankName: "GTBank", accountNumber: "0123456789" } });
  assert.equal(r.body.worker.bank.accountName, "CHIDI OKAFOR");
  assert.equal(r.body.worker.bank.accountNumber, "0123456789");
  const asStaff = await t.api("GET", `/api/admin/workers/${id}`, { token: staff });
  assert.equal(asStaff.body.worker.bank.accountNumber, "******6789");
  const banks = await t.api("GET", "/api/admin/workers/banks", { token: manager });
  assert.equal(banks.body.banks[0].code, "044");
});

test("cleaners: list shows jobs and unpaid earnings; can't delete with live jobs; delete → Bin", async () => {
  const id = (await t.api("POST", "/api/admin/workers", { token: manager, body: newWorker() })).body.worker._id;
  await Booking.create({ bookingId: "NG-100001", service: "Regular Cleaning", assignedWorker: id, status: "Assigned", schedule: { date: addDays(lagosDate(), 1), time: "09:00" }, customer: { email: "c@x.com" } });
  await Booking.create({ bookingId: "NG-100002", service: "Regular Cleaning", assignedWorker: id, status: "Completed", workerPay: { amount: 7500, status: "unpaid" }, customer: { email: "c@x.com" } });
  const list = await t.api("GET", "/api/admin/workers", { token: staff });
  assert.equal(list.body.items[0].upcoming, 1);
  assert.equal(list.body.items[0].completed, 1);
  assert.equal(list.body.items[0].unpaid, 7500);
  assert.equal((await t.api("DELETE", `/api/admin/workers/${id}`, { token: manager })).status, 400);
  await Booking.updateOne({ bookingId: "NG-100001" }, { status: "Cancelled" });
  assert.equal((await t.api("DELETE", `/api/admin/workers/${id}`, { token: manager })).status, 200);
  assert.equal(await Worker.countDocuments(), 0);
});

test("applicants: public form → admin accepts → cleaner account + welcome email", async () => {
  let r = await t.api("POST", "/api/applicants", { body: { firstName: "Bisi", email: "bisi@example.com", phone: "0701 234 5678", area: "Yaba" } });
  assert.equal(r.status, 400, "consent required");
  r = await t.api("POST", "/api/applicants", { body: { firstName: "Bisi<script>", lastName: "Ade", email: "bisi@example.com", phone: "0701 234 5678", area: "Yaba", experience: "3 years", consent: true } });
  assert.equal(r.status, 201);
  assert.ok(t.outbox.some((m) => m.type === "applicant-received"));
  const list = await t.api("GET", "/api/admin/applicants?status=new", { token: staff });
  assert.equal(list.body.items.length, 1);
  const a = list.body.items[0];
  assert.equal(a.firstName, "Bisi");
  assert.equal((await t.api("POST", `/api/admin/applicants/${a._id}/accept`, { token: staff })).status, 403);
  r = await t.api("POST", `/api/admin/applicants/${a._id}/accept`, { token: manager });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(await Worker.exists({ email: "bisi@example.com", areas: "Yaba" }));
  assert.equal((await t.api("POST", `/api/admin/applicants/${a._id}/accept`, { token: manager })).status, 400, "only once");
});

test("customers: list with spend, profile timeline, edit tags, delete → Bin", async () => {
  const b = await t.api("POST", "/api/admin/bookings", {
    token: owner,
    body: { area: "Ikoyi", address: "4 Bourdillon Road", service: "regular-cleaning", propertyType: "Flat", supplies: "customer", bedrooms: 1, bathrooms: 1, date: addDays(lagosDate(), 2), time: "09:00", firstName: "Kemi", lastName: "Ade", email: "kemi@example.com", phone: "0803 000 1111", payment: "offline", offlineMethod: "Cash" },
  });
  assert.equal(b.status, 201);
  const list = await t.api("GET", "/api/admin/customers?q=kemi", { token: staff });
  assert.equal(list.body.items[0].bookings, 1);
  assert.equal(list.body.items[0].spent, 15000);
  const id = list.body.items[0]._id;
  const prof = await t.api("GET", `/api/admin/customers/${id}`, { token: staff });
  assert.equal(prof.body.bookings.length, 1);
  assert.ok(prof.body.timeline.some((e) => e.kind === "booking"));
  assert.ok(prof.body.timeline.some((e) => e.kind === "email"));
  assert.equal(JSON.stringify(prof.body).includes("loginCode"), false);
  let r = await t.api("PATCH", `/api/admin/customers/${id}`, { token: staff, body: { tags: ["VIP", "VIP", "Lekki estate"], notes: "Prefers mornings" } });
  assert.deepEqual(r.body.customer.tags, ["VIP", "Lekki estate"]);
  r = await t.api("PATCH", `/api/admin/customers/${id}`, { token: staff, body: { phone: "123" } });
  assert.equal(r.status, 400);
  assert.equal((await t.api("DELETE", `/api/admin/customers/${id}`, { token: staff })).status, 403);
  assert.equal((await t.api("DELETE", `/api/admin/customers/${id}`, { token: manager })).status, 200);
  assert.equal(await Customer.countDocuments(), 0);
});

test("staff pay: payout request → owner pays (Paystack Transfer) → webhook marks paid, once", async () => {
  const w = await Worker.create({ firstName: "Chidi", lastName: "O", email: "c@cleaniq.test", passwordHash: "x", bank: { bankName: "GTBank", bankCode: "058", accountNumber: "0123456789", accountName: "CHIDI O" } });
  await Booking.create([
    { bookingId: "NG-200001", service: "Deep Cleaning", assignedWorker: w._id, status: "Completed", workerPay: { amount: 10500, status: "unpaid" }, customer: { email: "a@x.com" } },
    { bookingId: "NG-200002", service: "Deep Cleaning", assignedWorker: w._id, status: "Completed", workerPay: { amount: 7000, status: "unpaid" }, customer: { email: "a@x.com" } },
  ]);
  let r = await t.api("GET", "/api/admin/staff-pay", { token: manager });
  assert.equal(r.body.items[0].unpaid, 17500);
  r = await t.api("POST", "/api/admin/staff-pay/withdrawals", { token: manager, body: { workerId: w._id } });
  assert.equal(r.status, 201);
  const wd = r.body.withdrawal;
  assert.equal(wd.amount, 17500);
  assert.equal((await t.api("POST", "/api/admin/staff-pay/withdrawals", { token: manager, body: { workerId: w._id } })).status, 400, "one payout at a time");

  const [p1, p2] = await Promise.all([
    t.api("POST", `/api/admin/staff-pay/withdrawals/${wd._id}/pay`, { token: owner }),
    t.api("POST", `/api/admin/staff-pay/withdrawals/${wd._id}/pay`, { token: owner }),
  ]);
  assert.deepEqual([p1.status, p2.status].sort(), [200, 409], "double click can't send two transfers");
  assert.equal(paystack.calls.filter((c) => c.name === "transfer").length, 1);
  const transfer = paystack.calls.find((c) => c.name === "transfer").args;
  assert.equal(transfer.amountKobo, 1750000);
  assert.equal(transfer.recipient, "RCP_test123");

  const ref = (await Withdrawal.findById(wd._id)).reference;
  const raw = Buffer.from(JSON.stringify({ event: "transfer.success", data: { reference: ref } }));
  const sig = crypto.createHmac("sha512", t.config.paystackSecretKey).update(raw).digest("hex");
  await t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
  await t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
  assert.equal((await Withdrawal.findById(wd._id)).status, "Paid");
  assert.equal(await Booking.countDocuments({ "workerPay.status": "paid" }), 2);
});

test("staff pay: failed transfer puts the jobs back to unpaid; reject releases them", async () => {
  const w = await Worker.create({ firstName: "Ada", email: "ada@cleaniq.test", passwordHash: "x", bank: { bankName: "GTBank", bankCode: "058", accountNumber: "0123456789", accountName: "ADA" } });
  await Booking.create({ bookingId: "NG-300001", service: "Deep Cleaning", assignedWorker: w._id, status: "Completed", workerPay: { amount: 5000, status: "unpaid" }, customer: { email: "a@x.com" } });
  let wd = (await t.api("POST", "/api/admin/staff-pay/withdrawals", { token: manager, body: { workerId: w._id } })).body.withdrawal;
  await t.api("POST", `/api/admin/staff-pay/withdrawals/${wd._id}/pay`, { token: owner });
  const ref = (await Withdrawal.findById(wd._id)).reference;
  const raw = Buffer.from(JSON.stringify({ event: "transfer.failed", data: { reference: ref, reason: "Account closed" } }));
  const sig = crypto.createHmac("sha512", t.config.paystackSecretKey).update(raw).digest("hex");
  await t.api("POST", "/api/payments/paystack/webhook", { raw, headers: { "x-paystack-signature": sig, "Content-Type": "application/json" } });
  assert.equal((await Withdrawal.findById(wd._id)).status, "Failed");
  assert.equal((await Booking.findOne({ bookingId: "NG-300001" })).workerPay.status, "unpaid");

  wd = (await t.api("POST", "/api/admin/staff-pay/withdrawals", { token: manager, body: { workerId: w._id } })).body.withdrawal;
  const rej = await t.api("POST", `/api/admin/staff-pay/withdrawals/${wd._id}/reject`, { token: manager });
  assert.equal(rej.body.withdrawal.status, "Rejected");
  assert.equal((await Booking.findOne({ bookingId: "NG-300001" })).workerPay.withdrawal, undefined);
});

test("staff pay: cleaner without bank details can't be paid; the payout stays waiting", async () => {
  const w = await Worker.create({ firstName: "No", email: "nobank@cleaniq.test", passwordHash: "x" });
  await Booking.create({ bookingId: "NG-400001", service: "Deep Cleaning", assignedWorker: w._id, status: "Completed", workerPay: { amount: 5000, status: "unpaid" }, customer: { email: "a@x.com" } });
  const wd = (await t.api("POST", "/api/admin/staff-pay/withdrawals", { token: manager, body: { workerId: w._id } })).body.withdrawal;
  const r = await t.api("POST", `/api/admin/staff-pay/withdrawals/${wd._id}/pay`, { token: owner });
  assert.equal(r.status, 400);
  assert.equal((await Withdrawal.findById(wd._id)).status, "Requested");
});
