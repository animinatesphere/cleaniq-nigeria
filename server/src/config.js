// Reads settings from environment variables (server/.env in development) and refuses to start
// when something required is missing. Nothing secret is ever hard-coded here.

const REQUIRED_ALWAYS = ["MONGODB_URI", "JWT_SECRET", "ADMIN_JWT_SECRET", "FRONTEND_URL"];
// Payments and email must be configured before going live.
const REQUIRED_IN_PRODUCTION = ["PUBLIC_API_URL", "PAYSTACK_SECRET_KEY", "RESEND_API_KEY", "EMAIL_FROM"];

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const isTest = nodeEnv === "test";

  const required = isProduction ? [...REQUIRED_ALWAYS, ...REQUIRED_IN_PRODUCTION] : REQUIRED_ALWAYS;
  const missing = required.filter((k) => !String(env[k] || "").trim());
  if (missing.length) {
    throw new Error(`Missing required settings in server/.env: ${missing.join(", ")} (see server/.env.example)`);
  }
  for (const k of ["JWT_SECRET", "ADMIN_JWT_SECRET"]) {
    if (env[k].length < 32) throw new Error(`${k} must be at least 32 characters long`);
  }
  if (env.JWT_SECRET === env.ADMIN_JWT_SECRET) throw new Error("JWT_SECRET and ADMIN_JWT_SECRET must be different");

  return Object.freeze({
    nodeEnv,
    isProduction,
    isTest,
    port: Number(env.PORT) || 5050,
    mongoUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    adminJwtSecret: env.ADMIN_JWT_SECRET,
    frontendUrl: env.FRONTEND_URL.replace(/\/+$/, ""),
    publicApiUrl: (env.PUBLIC_API_URL || `http://localhost:${Number(env.PORT) || 5050}`).replace(/\/+$/, ""),
    paystackSecretKey: env.PAYSTACK_SECRET_KEY || "",
    paystackPublicKey: env.PAYSTACK_PUBLIC_KEY || "",
    resendApiKey: env.RESEND_API_KEY || "",
    emailFrom: env.EMAIL_FROM || "Cleaniq Nigeria <bookings@localhost>",
    teamEmail: env.TEAM_EMAIL || "",
    termiiApiKey: env.TERMII_API_KEY || "",
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  });
}

module.exports = { loadConfig, REQUIRED_ALWAYS, REQUIRED_IN_PRODUCTION };
