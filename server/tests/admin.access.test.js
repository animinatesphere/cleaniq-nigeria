// Every admin route must refuse requests without an admin login, and role-limited routes must refuse staff.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");

const ID = "64b7f0c2a1b2c3d4e5f60718";
const ROUTES = [
  ["GET", "/api/admin/dashboard"],
  ["GET", "/api/admin/bookings"], ["POST", "/api/admin/bookings"], ["POST", "/api/admin/bookings/price"],
  ["GET", "/api/admin/bookings/calendar?from=2026-10-01&to=2026-10-31"], ["GET", "/api/admin/bookings/jobs"],
  ["GET", "/api/admin/bookings/NG-123456"], ["PATCH", "/api/admin/bookings/NG-123456/status"], ["PATCH", "/api/admin/bookings/NG-123456/assign"],
  ["PATCH", "/api/admin/bookings/NG-123456/visibility"], ["PATCH", "/api/admin/bookings/NG-123456/schedule"], ["POST", "/api/admin/bookings/NG-123456/notes"],
  ["POST", "/api/admin/bookings/NG-123456/resend"], ["POST", "/api/admin/bookings/NG-123456/payment-link"], ["POST", "/api/admin/bookings/NG-123456/mark-paid"],
  ["POST", "/api/admin/bookings/NG-123456/cancel"], ["POST", "/api/admin/bookings/NG-123456/refund"], ["PATCH", "/api/admin/bookings/NG-123456/worker-pay"],
  ["DELETE", "/api/admin/bookings/NG-123456"],
  ["GET", "/api/admin/customers"], ["GET", `/api/admin/customers/${ID}`], ["PATCH", `/api/admin/customers/${ID}`], ["DELETE", `/api/admin/customers/${ID}`],
  ["GET", "/api/admin/workers"], ["GET", "/api/admin/workers/banks"], ["GET", `/api/admin/workers/${ID}`], ["POST", "/api/admin/workers"],
  ["PATCH", `/api/admin/workers/${ID}`], ["PATCH", `/api/admin/workers/${ID}/bank`], ["POST", `/api/admin/workers/${ID}/status`],
  ["POST", `/api/admin/workers/${ID}/reset-password`], ["DELETE", `/api/admin/workers/${ID}`],
  ["GET", "/api/admin/applicants"], ["POST", `/api/admin/applicants/${ID}/accept`], ["POST", `/api/admin/applicants/${ID}/reject`],
  ["GET", "/api/admin/services"], ["POST", "/api/admin/services"], ["PATCH", `/api/admin/services/${ID}`], ["DELETE", `/api/admin/services/${ID}`],
  ["GET", "/api/admin/quotes"], ["POST", "/api/admin/quotes"], ["POST", "/api/admin/quotes/price"], ["GET", "/api/admin/quotes/Q-NG-123456"],
  ["POST", "/api/admin/quotes/Q-NG-123456/resend"], ["POST", "/api/admin/quotes/Q-NG-123456/decline"], ["DELETE", "/api/admin/quotes/Q-NG-123456"],
  ["GET", "/api/admin/payments"],
  ["GET", "/api/admin/staff-pay"], ["GET", `/api/admin/staff-pay/workers/${ID}/jobs`], ["GET", "/api/admin/staff-pay/withdrawals"],
  ["POST", "/api/admin/staff-pay/withdrawals"], ["POST", `/api/admin/staff-pay/withdrawals/${ID}/pay`], ["POST", `/api/admin/staff-pay/withdrawals/${ID}/reject`],
  ["GET", "/api/admin/settings"], ["PUT", "/api/admin/settings/business"], ["PUT", "/api/admin/settings/pricing"],
  ["GET", "/api/admin/settings/admins"], ["POST", "/api/admin/settings/admins"], ["PATCH", `/api/admin/settings/admins/${ID}`], ["POST", `/api/admin/settings/admins/${ID}/reset-password`],
  ["GET", "/api/admin/emails"], ["GET", "/api/admin/bin"], ["POST", `/api/admin/bin/${ID}/restore`], ["DELETE", `/api/admin/bin/${ID}`], ["GET", "/api/admin/audit"],
];

// Routes staff must not use (owner/manager or owner only).
const NOT_FOR_STAFF = [
  ["POST", "/api/admin/bookings/NG-123456/mark-paid"], ["POST", "/api/admin/bookings/NG-123456/cancel"], ["POST", "/api/admin/bookings/NG-123456/refund"],
  ["PATCH", "/api/admin/bookings/NG-123456/worker-pay"], ["DELETE", "/api/admin/bookings/NG-123456"], ["DELETE", `/api/admin/customers/${ID}`],
  ["GET", "/api/admin/workers/banks"], ["POST", "/api/admin/workers"], ["PATCH", `/api/admin/workers/${ID}`], ["PATCH", `/api/admin/workers/${ID}/bank`],
  ["POST", `/api/admin/workers/${ID}/status`], ["POST", `/api/admin/workers/${ID}/reset-password`], ["DELETE", `/api/admin/workers/${ID}`],
  ["POST", `/api/admin/applicants/${ID}/accept`], ["POST", `/api/admin/applicants/${ID}/reject`],
  ["POST", "/api/admin/services"], ["PATCH", `/api/admin/services/${ID}`], ["DELETE", `/api/admin/services/${ID}`], ["DELETE", "/api/admin/quotes/Q-NG-123456"],
  ["GET", "/api/admin/payments"], ["GET", "/api/admin/staff-pay"], ["GET", "/api/admin/staff-pay/withdrawals"], ["POST", "/api/admin/staff-pay/withdrawals"],
  ["POST", `/api/admin/staff-pay/withdrawals/${ID}/pay`], ["POST", `/api/admin/staff-pay/withdrawals/${ID}/reject`],
  ["PUT", "/api/admin/settings/business"], ["PUT", "/api/admin/settings/pricing"], ["GET", "/api/admin/settings/admins"], ["POST", "/api/admin/settings/admins"],
  ["GET", "/api/admin/bin"], ["POST", `/api/admin/bin/${ID}/restore`], ["DELETE", `/api/admin/bin/${ID}`], ["GET", "/api/admin/audit"],
];
// Owner only — managers refused too.
const OWNER_ONLY = [
  ["DELETE", "/api/admin/bookings/NG-123456"], ["POST", `/api/admin/staff-pay/withdrawals/${ID}/pay`], ["GET", "/api/admin/settings/admins"],
  ["POST", "/api/admin/settings/admins"], ["PATCH", `/api/admin/settings/admins/${ID}`], ["POST", `/api/admin/settings/admins/${ID}/reset-password`],
  ["DELETE", `/api/admin/bin/${ID}`], ["GET", "/api/admin/audit"],
];

let t;
let staff;
let manager;
before(async () => {
  t = await startTestServer({ deps: { paystack: fakePaystack() } });
  staff = await t.adminToken("staff");
  manager = await t.adminToken("manager");
});
after(async () => t.stop());

test("every admin route refuses without a login", async () => {
  for (const [method, path] of ROUTES) {
    const r = await t.api(method, path, { body: method === "GET" ? undefined : {} });
    assert.equal(r.status, 401, `${method} ${path} should need a login (got ${r.status})`);
  }
});

test("a customer or worker token is not an admin login", async () => {
  const jwt = require("jsonwebtoken");
  const fakeCustomer = jwt.sign({ typ: "customer" }, t.config.jwtSecret, { subject: ID });
  const forged = jwt.sign({ typ: "admin", role: "owner" }, t.config.jwtSecret, { subject: ID }); // signed with the wrong secret
  for (const token of [fakeCustomer, forged]) {
    const r = await t.api("GET", "/api/admin/dashboard", { token });
    assert.equal(r.status, 401);
  }
});

test("staff can't use owner/manager actions", async () => {
  for (const [method, path] of NOT_FOR_STAFF) {
    const r = await t.api(method, path, { token: staff, body: method === "GET" ? undefined : {} });
    assert.equal(r.status, 403, `${method} ${path} should refuse staff (got ${r.status})`);
  }
});

test("managers can't use owner-only actions", async () => {
  for (const [method, path] of OWNER_ONLY) {
    const r = await t.api(method, path, { token: manager, body: method === "GET" ? undefined : {} });
    assert.equal(r.status, 403, `${method} ${path} should refuse managers (got ${r.status})`);
  }
});

test("a deactivated admin's token stops working", async () => {
  const Admin = require("../src/models/Admin");
  const token = await t.adminToken("staff", "leaver@cleaniq.test");
  assert.equal((await t.api("GET", "/api/admin/dashboard", { token })).status, 200);
  await Admin.updateOne({ email: "leaver@cleaniq.test" }, { active: false });
  assert.equal((await t.api("GET", "/api/admin/dashboard", { token })).status, 401);
});
