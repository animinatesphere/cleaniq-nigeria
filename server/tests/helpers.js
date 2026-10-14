// Test harness: an in-memory MongoDB, the real app on a random port, and a small fetch wrapper.
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { loadConfig } = require("../src/config");
const { createApp } = require("../src/app");
const { outbox } = require("../src/lib/email");
const Admin = require("../src/models/Admin");

const TEST_ENV = {
  NODE_ENV: "test",
  JWT_SECRET: "test-customer-secret-0123456789-abcdefghijklmnop",
  ADMIN_JWT_SECRET: "test-admin-secret-0123456789-abcdefghijklmnopqrs",
  FRONTEND_URL: "http://localhost:5173",
  PAYSTACK_SECRET_KEY: "sk_test_secret_for_tests",
};

async function startTestServer({ deps = {}, env = {} } = {}) {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("cleaniq_ng_test"));
  const config = loadConfig({ ...TEST_ENV, MONGODB_URI: mongod.getUri(), ...env });
  const app = createApp(config, deps);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, path, { body, token, headers = {}, raw } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && !raw ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  async function reset() {
    await mongoose.connection.db.dropDatabase();
    outbox.length = 0;
  }

  async function stop() {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  }

  // Creates an admin and returns a logged-in token.
  async function adminToken(role = "owner", email = `${role}@cleaniq.test`) {
    await Admin.create({ name: role, email, role, passwordHash: await bcrypt.hash("correct-horse-battery", 4) });
    const r = await api("POST", "/api/auth/admin/login", { body: { email, password: "correct-horse-battery" } });
    return r.body.token;
  }

  return { api, reset, stop, config, app, outbox, adminToken, base };
}

module.exports = { startTestServer, TEST_ENV };
