const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { startTestServer } = require("./helpers");
const Worker = require("../src/models/Worker");
const Customer = require("../src/models/Customer");

let t;
before(async () => (t = await startTestServer()));
after(async () => t.stop());
beforeEach(async () => t.reset());

test("health check", async () => {
  const r = await t.api("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
});

test("unknown API route gives JSON 404", async () => {
  const r = await t.api("GET", "/api/nope");
  assert.equal(r.status, 404);
  assert.equal(r.body.error, "Not found");
});

test("admin login: wrong password refused, right password gives a token", async () => {
  await t.adminToken("owner", "boss@cleaniq.test");
  const bad = await t.api("POST", "/api/auth/admin/login", { body: { email: "boss@cleaniq.test", password: "nope" } });
  assert.equal(bad.status, 401);
  const good = await t.api("POST", "/api/auth/admin/login", { body: { email: "BOSS@cleaniq.test", password: "correct-horse-battery" } });
  assert.equal(good.status, 200);
  assert.ok(good.body.token);
  assert.equal(good.body.admin.role, "owner");
  assert.equal(good.body.admin.passwordHash, undefined);
});

test("admin me refuses without login or with a customer token", async () => {
  assert.equal((await t.api("GET", "/api/auth/admin/me")).status, 401);
  assert.equal((await t.api("GET", "/api/auth/admin/me", { token: "garbage" })).status, 401);
  // A customer token must not work as an admin token.
  await t.api("POST", "/api/auth/customer/request-code", { body: { email: "ada@example.com" } });
  const code = t.outbox.at(-1).subject.match(/(\d{6})/)[1];
  const login = await t.api("POST", "/api/auth/customer/verify-code", { body: { email: "ada@example.com", code } });
  assert.equal((await t.api("GET", "/api/auth/admin/me", { token: login.body.token })).status, 401);
  const token = await t.adminToken("staff");
  const me = await t.api("GET", "/api/auth/admin/me", { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.admin.role, "staff");
});

test("admin change password needs the current password", async () => {
  const token = await t.adminToken("manager");
  assert.equal((await t.api("POST", "/api/auth/admin/change-password", { body: {} })).status, 401);
  const wrong = await t.api("POST", "/api/auth/admin/change-password", { token, body: { currentPassword: "x", newPassword: "a-new-long-password" } });
  assert.equal(wrong.status, 401);
  const ok = await t.api("POST", "/api/auth/admin/change-password", { token, body: { currentPassword: "correct-horse-battery", newPassword: "a-new-long-password" } });
  assert.equal(ok.status, 200);
  const relog = await t.api("POST", "/api/auth/admin/login", { body: { email: "manager@cleaniq.test", password: "a-new-long-password" } });
  assert.equal(relog.status, 200);
});

test("customer: email code signs up, wrong code counts attempts, code is single-use", async () => {
  const bad = await t.api("POST", "/api/auth/customer/request-code", { body: { email: "not-an-email" } });
  assert.equal(bad.status, 400);

  const req = await t.api("POST", "/api/auth/customer/request-code", { body: { email: "Ada@Example.com" } });
  assert.equal(req.status, 200);
  const mail = t.outbox.at(-1);
  assert.equal(mail.to, "ada@example.com");
  const code = mail.subject.match(/(\d{6})/)[1];

  // The code is stored hashed, never readable.
  const stored = await Customer.findOne({ email: "ada@example.com" }).select("+loginCode.hash").lean();
  assert.notEqual(stored.loginCode.hash, code);

  const wrong = await t.api("POST", "/api/auth/customer/verify-code", { body: { email: "ada@example.com", code: code === "000000" ? "111111" : "000000" } });
  assert.equal(wrong.status, 401);

  const ok = await t.api("POST", "/api/auth/customer/verify-code", {
    body: { email: "ada@example.com", code, firstName: "Ada<b>", lastName: "Obi", phone: "0803 123 4567" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.customer.firstName, "Ada");
  assert.equal(ok.body.customer.phone, "+2348031234567");

  const again = await t.api("POST", "/api/auth/customer/verify-code", { body: { email: "ada@example.com", code } });
  assert.equal(again.status, 401, "code can only be used once");

  const me = await t.api("GET", "/api/auth/customer/me", { token: ok.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.customer.email, "ada@example.com");
  assert.equal((await t.api("GET", "/api/auth/customer/me")).status, 401);
});

test("customer: code locks after 5 wrong tries", async () => {
  await t.api("POST", "/api/auth/customer/request-code", { body: { email: "lock@example.com" } });
  const code = t.outbox.at(-1).subject.match(/(\d{6})/)[1];
  const wrongCode = code === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i++) {
    await t.api("POST", "/api/auth/customer/verify-code", { body: { email: "lock@example.com", code: wrongCode } });
  }
  const r = await t.api("POST", "/api/auth/customer/verify-code", { body: { email: "lock@example.com", code } });
  assert.equal(r.status, 401);
});

test("worker: login by email or phone; suspended workers refused", async () => {
  await Worker.create({
    firstName: "Chidi", email: "chidi@cleaniq.test", phone: "+2348031112222",
    passwordHash: await bcrypt.hash("worker-password-1", 4),
  });
  const byEmail = await t.api("POST", "/api/auth/worker/login", { body: { login: "chidi@cleaniq.test", password: "worker-password-1" } });
  assert.equal(byEmail.status, 200);
  const byPhone = await t.api("POST", "/api/auth/worker/login", { body: { login: "0803 111 2222", password: "worker-password-1" } });
  assert.equal(byPhone.status, 200);
  const wrong = await t.api("POST", "/api/auth/worker/login", { body: { login: "chidi@cleaniq.test", password: "x" } });
  assert.equal(wrong.status, 401);
  await Worker.updateOne({ email: "chidi@cleaniq.test" }, { status: "suspended" });
  const suspended = await t.api("POST", "/api/auth/worker/login", { body: { login: "chidi@cleaniq.test", password: "worker-password-1" } });
  assert.equal(suspended.status, 401);
});

test("admin login is rate-limited", async () => {
  let last;
  for (let i = 0; i < 11; i++) {
    last = await t.api("POST", "/api/auth/admin/login", { body: { email: "x@cleaniq.test", password: "y" } });
  }
  assert.equal(last.status, 429);
});
