// npm run seed — creates the first owner admin (from SEED_OWNER_* in .env) and a starter price list.
// Safe to run again: it never overwrites an existing admin or service.
const bcrypt = require("bcryptjs");
const { loadConfig } = require("./config");
const { connectDb, disconnectDb } = require("./lib/db");
const Admin = require("./models/Admin");
const { seedServices } = require("./lib/seedData");

async function main() {
  const config = loadConfig();
  await connectDb(config.mongoUri);

  const { SEED_OWNER_NAME, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD } = process.env;
  if (SEED_OWNER_EMAIL && SEED_OWNER_PASSWORD) {
    if (SEED_OWNER_PASSWORD.length < 10) throw new Error("SEED_OWNER_PASSWORD must be at least 10 characters");
    const email = SEED_OWNER_EMAIL.trim().toLowerCase();
    if (await Admin.exists({ email })) {
      console.log(`Owner admin ${email} already exists — left unchanged.`);
    } else {
      await Admin.create({ name: SEED_OWNER_NAME || "Owner", email, role: "owner", passwordHash: await bcrypt.hash(SEED_OWNER_PASSWORD, 12) });
      console.log(`Created owner admin ${email}. You can now remove SEED_OWNER_PASSWORD from .env.`);
    }
  } else {
    console.log("SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD not set — no admin created.");
  }

  const created = await seedServices();
  console.log(created ? `Added ${created} starter services (prices in naira — review them in admin).` : "Price list already exists — left unchanged.");
  await disconnectDb();
}

main().catch(async (e) => {
  console.error("Seed failed:", e.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
