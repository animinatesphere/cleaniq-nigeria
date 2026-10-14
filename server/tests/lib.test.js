const { test } = require("node:test");
const assert = require("node:assert/strict");
const { round2, toKobo, fromKobo, formatNaira } = require("../src/lib/money");
const time = require("../src/lib/time");
const { clean, normaliseNgPhone, escapeHtml, isEmail } = require("../src/lib/text");
const { loadConfig } = require("../src/config");
const { TEST_ENV } = require("./helpers");

test("money: rounds to 2 decimals and converts to kobo", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(10 / 3), 3.33);
  assert.equal(toKobo(12500.5), 1250050);
  assert.equal(toKobo(0.1 + 0.2), 30);
  assert.equal(fromKobo(1250050), 12500.5);
  assert.equal(formatNaira(12500), "₦12,500.00");
});

test("time: Lagos is UTC+1 with no daylight saving", () => {
  // 23:30 UTC on 14 Oct is already 15 Oct in Lagos.
  assert.equal(time.lagosDate(new Date("2026-10-14T23:30:00Z")), "2026-10-15");
  assert.equal(time.lagosTime(new Date("2026-10-14T23:30:00Z")), "00:30");
  // Same offset in (UK) summer and winter.
  assert.equal(time.lagosTime(new Date("2026-07-01T07:00:00Z")), "08:00");
  assert.equal(time.lagosTime(new Date("2026-01-01T07:00:00Z")), "08:00");
  assert.equal(time.lagosToInstant("2026-10-15", "08:00").toISOString(), "2026-10-15T07:00:00.000Z");
  assert.equal(time.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(time.isValidDate("2026-02-30"), false);
  assert.equal(time.isValidDate("2026-02-28"), true);
  assert.equal(time.isValidTime("18:00"), true);
  assert.equal(time.isValidTime("24:00"), false);
  assert.equal(time.formatTime("08:30"), "8:30am");
  assert.equal(time.formatTime("13:00"), "1:00pm");
  assert.equal(time.formatLagosDate("2026-10-15"), "Thursday 15 October 2026");
});

test("text: strips HTML and normalises Nigerian phone numbers", () => {
  assert.equal(clean("<script>alert(1)</script>Hello <b>there</b>"), "alert(1)Hello there");
  assert.equal(clean("x".repeat(20), 5), "xxxxx");
  assert.equal(escapeHtml(`<a href="x">`), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(normaliseNgPhone("0803 123 4567"), "+2348031234567");
  assert.equal(normaliseNgPhone("+234 803 123 4567"), "+2348031234567");
  assert.equal(normaliseNgPhone("2348031234567"), "+2348031234567");
  assert.equal(normaliseNgPhone("8031234567"), "+2348031234567");
  assert.equal(normaliseNgPhone("07012345678"), "+2347012345678");
  assert.equal(normaliseNgPhone("12345"), null);
  assert.equal(normaliseNgPhone("+44 7700 900123"), null);
  assert.equal(isEmail("ada@example.com"), true);
  assert.equal(isEmail("ada@example"), false);
});

test("config: refuses to start without required settings", () => {
  assert.throws(() => loadConfig({}), /MONGODB_URI/);
  assert.throws(() => loadConfig({ ...TEST_ENV, MONGODB_URI: "mongodb://x", JWT_SECRET: "short" }), /at least 32/);
  assert.throws(
    () => loadConfig({ ...TEST_ENV, MONGODB_URI: "mongodb://x", ADMIN_JWT_SECRET: TEST_ENV.JWT_SECRET }),
    /must be different/,
  );
  // Production also needs payments and email.
  assert.throws(() => loadConfig({ ...TEST_ENV, NODE_ENV: "production", MONGODB_URI: "mongodb://x" }), /RESEND_API_KEY/);
  const c = loadConfig({ ...TEST_ENV, MONGODB_URI: "mongodb://x" });
  assert.equal(c.isTest, true);
});
