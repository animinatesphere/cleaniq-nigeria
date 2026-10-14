const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const { seedServices } = require("../src/lib/seedData");
const Admin = require("../src/models/Admin");
const Service = require("../src/models/Service");

let t, owner, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack: fakePaystack() } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  await seedServices();
  owner = await t.adminToken("owner");
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

test("price list: managers edit; the public list and prices follow; changes are logged", async () => {
  const list = await t.api("GET", "/api/admin/services", { token: staff });
  const regular = list.body.items.find((s) => s.slug === "regular-cleaning");
  assert.ok("workerHourlyRate" in regular, "admin sees cleaner pay");
  let r = await t.api("PATCH", `/api/admin/services/${regular._id}`, { token: manager, body: { rate: 5500, weeklyRate: "", monthlyRate: 5000 } });
  assert.equal(r.body.service.rate, 5500);
  assert.equal(r.body.service.weeklyRate, null);
  const pub = await t.api("GET", "/api/services");
  const freq = pub.body.base.find((s) => s.slug === "regular-cleaning").frequencies.map((f) => f.key);
  assert.deepEqual(freq, ["once", "fortnightly", "monthly"]);
  const price = await t.api("POST", "/api/bookings/quote-price", { body: { service: "regular-cleaning", hours: 2, supplies: "customer" } });
  assert.equal(price.body.total, 11000);
  const audit = await t.api("GET", "/api/admin/audit?q=service.update", { token: owner });
  assert.equal(audit.body.items[0].details.rate.to, 5500);
  r = await t.api("PATCH", `/api/admin/services/${regular._id}`, { token: manager, body: { rate: -5 } });
  assert.equal(r.status, 400);
});

test("price list: add an add-on with options; delete → Bin; inactive hidden from public", async () => {
  let r = await t.api("POST", "/api/admin/services", { token: manager, body: { name: "Mattress cleaning", category: "Extras", type: "flat", rate: 9000, unitLabel: "mattress" } });
  assert.equal(r.status, 201);
  assert.equal(r.body.service.slug, "extra-mattress-cleaning");
  assert.equal((await t.api("POST", "/api/admin/services", { token: manager, body: { name: "Mattress cleaning", category: "Extras", type: "flat", rate: 9000 } })).status, 409);
  await t.api("PATCH", `/api/admin/services/${r.body.service._id}`, { token: manager, body: { active: false } });
  assert.ok(!(await t.api("GET", "/api/services")).body.extras.some((x) => x.slug === "extra-mattress-cleaning"));
  assert.equal((await t.api("DELETE", `/api/admin/services/${r.body.service._id}`, { token: manager })).status, 200);
  assert.equal(await Service.countDocuments({ slug: "extra-mattress-cleaning" }), 0);
});

test("settings: VAT switch and supplies fee change live prices; business details validated", async () => {
  let r = await t.api("PUT", "/api/admin/settings/pricing", { token: manager, body: { vat: { enabled: true, rate: 7.5 }, suppliesFee: 3000 } });
  assert.equal(r.status, 200);
  const price = await t.api("POST", "/api/bookings/quote-price", { body: { service: "regular-cleaning", hours: 2, supplies: "cleaniq" } });
  assert.equal(price.body.subtotal, 13000);
  assert.equal(price.body.total, 13975);
  r = await t.api("PUT", "/api/admin/settings/business", { token: manager, body: { name: "Cleaniq Nigeria", whatsapp: "0803 111 2222", email: "nope" } });
  assert.equal(r.status, 400);
  r = await t.api("PUT", "/api/admin/settings/business", { token: manager, body: { name: "Cleaniq Nigeria", whatsapp: "0803 111 2222", email: "hello@cleaniq.ng" } });
  assert.equal(r.body.business.whatsapp, "+2348031112222");
  const s = await t.api("GET", "/api/admin/settings", { token: staff });
  assert.equal(s.body.integrations.paystack, true);
  assert.equal(JSON.stringify(s.body).includes(t.config.paystackSecretKey), false, "keys are never shown");
});

test("admin users: owner invites (temporary password emailed), changes roles; always one owner", async () => {
  let r = await t.api("POST", "/api/admin/settings/admins", { token: owner, body: { name: "Sade", email: "sade@cleaniq.test", role: "staff" } });
  assert.equal(r.status, 201);
  const mail = t.outbox.find((m) => m.type === "admin-invite");
  const pw = mail.html.match(/Temporary password<\/td><td[^>]*>([^<]+)</)[1];
  const login = await t.api("POST", "/api/auth/admin/login", { body: { email: "sade@cleaniq.test", password: pw } });
  assert.equal(login.status, 200);
  assert.equal(login.body.admin.mustChangePassword, true);
  r = await t.api("PATCH", `/api/admin/settings/admins/${r.body.admin._id}`, { token: owner, body: { role: "manager" } });
  assert.equal(r.body.admin.role, "manager");
  const me = await Admin.findOne({ role: "owner" });
  r = await t.api("PATCH", `/api/admin/settings/admins/${me._id}`, { token: owner, body: { role: "staff" } });
  assert.equal(r.status, 400, "can't remove the last owner");
  const list = await t.api("GET", "/api/admin/settings/admins", { token: owner });
  assert.ok(list.body.items.every((a) => a.passwordHash === undefined));
});

test("email history lists every email, with filters", async () => {
  await t.api("POST", "/api/admin/settings/admins", { token: owner, body: { name: "Sade", email: "sade@cleaniq.test", role: "staff" } });
  const r = await t.api("GET", "/api/admin/emails?q=sade", { token: staff });
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].status, "sent");
});
