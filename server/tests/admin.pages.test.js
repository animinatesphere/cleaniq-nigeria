// The other admin pages: records (tasks, complaints…), leads/pipeline, expenses, analytics,
// cleaner performance, blog, chat support, automations, SMS and AI settings.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers");
const { fakePaystack } = require("./fakePaystack");
const Payment = require("../src/models/Payment");
const Booking = require("../src/models/Booking");
const Worker = require("../src/models/Worker");
const BlogPost = require("../src/models/BlogPost");
const TrashItem = require("../src/models/TrashItem");
const { publishDuePosts } = require("../src/lib/blog");
const { lagosDate } = require("../src/lib/time");

const paystack = fakePaystack();
let t, owner, manager, staff;
before(async () => (t = await startTestServer({ deps: { paystack } })));
after(async () => t.stop());
beforeEach(async () => {
  await t.reset();
  owner = await t.adminToken("owner");
  manager = await t.adminToken("manager");
  staff = await t.adminToken("staff");
});

test("records: every type lists, adds, edits, deletes to the Bin; unknown fields and bad values refused", async () => {
  const types = (await t.api("GET", "/api/admin/c/types", { token: staff })).body.types;
  assert.ok(Object.keys(types).length >= 15);
  const add = await t.api("POST", "/api/admin/c/complaint", { token: staff, body: { customer: "Ada", details: "Missed the kitchen", status: "Open", hacked: "x" } });
  assert.equal(add.status, 201, JSON.stringify(add.body));
  assert.equal(add.body.item.data.hacked, undefined);
  assert.equal((await t.api("POST", "/api/admin/c/complaint", { token: staff, body: { customer: "" } })).status, 400);
  const edit = await t.api("PATCH", `/api/admin/c/complaint/${add.body.item._id}`, { token: staff, body: { status: "Resolved" } });
  assert.equal(edit.body.item.status, "Resolved");
  const list = await t.api("GET", "/api/admin/c/complaint?q=kitchen", { token: staff });
  assert.equal(list.body.items.length, 1);
  assert.equal((await t.api("GET", "/api/admin/c/nope", { token: staff })).status, 404);
  const del = await t.api("DELETE", `/api/admin/c/complaint/${add.body.item._id}`, { token: manager });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(await TrashItem.countDocuments(), 1);
});

test("leads: add, move through the pipeline (with a note), board view", async () => {
  const r = await t.api("POST", "/api/admin/leads", { token: staff, body: { name: "Kemi", phone: "0803", source: "instagram" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await t.api("POST", "/api/admin/leads", { token: staff, body: { name: "No contact" } })).status, 400);
  const m = await t.api("PATCH", `/api/admin/leads/${r.body.lead._id}`, { token: staff, body: { stage: "quoted", value: 80000 } });
  assert.equal(m.body.lead.stage, "quoted");
  assert.match(m.body.lead.notes.at(-1).text, /new to quoted/);
  const board = await t.api("GET", "/api/admin/leads?board=1", { token: staff });
  assert.equal(board.body.counts.quoted.value, 80000);
  assert.equal((await t.api("DELETE", `/api/admin/leads/${r.body.lead._id}`, { token: staff })).status, 403);
});

test("expenses: managers only; month total and by category", async () => {
  assert.equal((await t.api("GET", "/api/admin/expenses", { token: staff })).status, 403);
  const d = lagosDate();
  await t.api("POST", "/api/admin/expenses", { token: manager, body: { date: d, amount: 12000, category: "Fuel" } });
  await t.api("POST", "/api/admin/expenses", { token: manager, body: { date: d, amount: 8000, category: "Supplies" } });
  assert.equal((await t.api("POST", "/api/admin/expenses", { token: manager, body: { date: "x", amount: 0 } })).status, 400);
  const r = await t.api("GET", `/api/admin/expenses?month=${d.slice(0, 7)}`, { token: manager });
  assert.equal(r.body.monthTotal, 20000);
  assert.equal(r.body.byCategory[0].category, "Fuel");
});

test("analytics: monthly revenue minus refunds, expenses and staff pay = profit; where money came from", async () => {
  const d = lagosDate();
  await Booking.create({ bookingId: "NG-100001", service: "Deep Cleaning", customer: { email: "a@x.com" }, details: { area: "Lekki" }, schedule: { date: d }, status: "Completed", payment: { amount: 50000, status: "Paid", paidAt: new Date(), plan: "payNow" } });
  await Payment.create({ reference: "R1", bookingId: "NG-100001", amount: 50000, status: "success", paidAt: new Date() });
  await t.api("POST", "/api/admin/expenses", { token: manager, body: { date: d, amount: 10000, category: "Fuel" } });
  assert.equal((await t.api("GET", "/api/admin/analytics", { token: staff })).status, 403);
  const r = await t.api("GET", "/api/admin/analytics?months=6", { token: manager });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.monthly.length, 6);
  const cur = r.body.monthly.at(-1);
  assert.equal(cur.revenue, 50000);
  assert.equal(cur.profit, 40000);
  assert.equal(r.body.bySource[0].name, "Pay now");
  assert.equal(r.body.byService[0].name, "Deep Cleaning");
  assert.equal(r.body.days.length, 30);
  assert.equal(r.body.days.at(-1).revenue, 50000);
});

test("cleaner performance: jobs, rating, value", async () => {
  const w = await Worker.create({ firstName: "Ada", email: "ada@cleaniq.test", passwordHash: "x" });
  const d = lagosDate();
  await Booking.create([
    { bookingId: "NG-1", service: "S", assignedWorker: w._id, status: "Completed", schedule: { date: d, time: "09:00" }, payment: { amount: 30000 }, cleanerRating: { stars: 5 } },
    { bookingId: "NG-2", service: "S", assignedWorker: w._id, status: "Completed", schedule: { date: d, time: "13:00" }, payment: { amount: 20000 }, cleanerRating: { stars: 4 } },
  ]);
  const r = await t.api("GET", `/api/admin/analytics/cleaners?month=${d.slice(0, 7)}`, { token: manager });
  const row = r.body.cleaners[0];
  assert.equal(row.completed, 2);
  assert.equal(row.value, 50000);
  assert.equal(row.rating, 4.5);
});

test("blog: create, schedule (future only), publish due posts, public list only shows published", async () => {
  const a = await t.api("POST", "/api/admin/blog", { token: staff, body: { title: "Harmattan dust tips", body: "Hello", status: "published" } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.post.slug, "harmattan-dust-tips");
  const b = await t.api("POST", "/api/admin/blog", { token: staff, body: { title: "Harmattan dust tips", status: "scheduled", publishAt: new Date(Date.now() + 3600e3).toISOString() } });
  assert.equal(b.body.post.slug, "harmattan-dust-tips-2");
  assert.equal((await t.api("POST", "/api/admin/blog", { token: staff, body: { title: "X", status: "scheduled", publishAt: "2020-01-01" } })).status, 400);
  assert.equal((await t.api("POST", "/api/admin/blog", { token: staff, body: { title: "X", coverImage: "javascript:alert(1)" } })).status, 400);
  let pub = await t.api("GET", "/api/blog");
  assert.equal(pub.body.items.length, 1);
  await BlogPost.updateOne({ _id: b.body.post._id }, { publishAt: new Date(Date.now() - 1000) });
  assert.equal(await publishDuePosts(), 1);
  pub = await t.api("GET", "/api/blog");
  assert.equal(pub.body.items.length, 2);
  assert.equal((await t.api("GET", "/api/blog/harmattan-dust-tips-2")).status, 200);
  assert.equal((await t.api("POST", "/api/admin/blog/draft", { token: staff, body: { topic: "x" } })).status, 400); // no Claude key in tests
});

test("chat support: website message opens a conversation (+ lead); admin replies by email", async () => {
  const m = await t.api("POST", "/api/support", { body: { name: "Ngozi", email: "ngozi@x.com", message: "Do you clean offices in Ikeja?" } });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  await t.api("POST", "/api/support", { body: { name: "Ngozi", email: "ngozi@x.com", message: "Also on Saturdays?" } });
  const list = await t.api("GET", "/api/admin/support", { token: staff });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.unread, 1);
  const th = await t.api("GET", `/api/admin/support/${m.body.ref}`, { token: staff });
  assert.equal(th.body.thread.messages.length, 2);
  t.outbox.length = 0;
  const rep = await t.api("POST", `/api/admin/support/${m.body.ref}/reply`, { token: staff, body: { text: "Yes, we do!" } });
  assert.equal(rep.body.thread.status, "waiting");
  assert.equal(t.outbox[0].to, "ngozi@x.com");
  assert.equal((await t.api("POST", "/api/support", { body: { name: "", email: "bad", message: "" } })).status, 400);
});

test("automations, SMS and AI settings: managers change them, staff can only look", async () => {
  assert.equal((await t.api("GET", "/api/admin/automations", { token: staff })).body.automations.payAfterInvoice, true);
  assert.equal((await t.api("PUT", "/api/admin/automations", { token: staff, body: { payAfterInvoice: false } })).status, 403);
  const a = await t.api("PUT", "/api/admin/automations", { token: manager, body: { payAfterInvoice: false, junk: true } });
  assert.equal(a.body.automations.payAfterInvoice, false);
  assert.equal(a.body.automations.junk, undefined);
  const s = await t.api("PUT", "/api/admin/automations/sms", { token: manager, body: { enabled: true, templates: { reminder: "See you {date}" } } });
  assert.equal(s.body.sms.templates.reminder, "See you {date}");
  assert.ok(s.body.sms.templates.invoice);
  const ai = await t.api("PUT", "/api/admin/automations/ai", { token: owner, body: { names: "Tunde, Emeka", greeting: "Hello" } });
  assert.deepEqual(ai.body.ai.names, ["Tunde", "Emeka"]);
  assert.equal((await t.api("PUT", "/api/admin/automations/ai", { token: owner, body: { names: "" } })).status, 400);
});
