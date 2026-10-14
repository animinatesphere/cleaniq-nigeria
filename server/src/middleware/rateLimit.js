// Rate limits for logins and public forms. Each app instance gets its own counters (tests stay isolated).
const { rateLimit } = require("express-rate-limit");

function limiter({ windowMinutes, max, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: message },
  });
}

function makeLimiters() {
  return {
    adminLogin: limiter({ windowMinutes: 15, max: 10, message: "Too many login attempts. Please wait 15 minutes and try again." }),
    login: limiter({ windowMinutes: 15, max: 20, message: "Too many login attempts. Please wait 15 minutes and try again." }),
    loginCode: limiter({ windowMinutes: 15, max: 5, message: "Too many codes requested. Please wait 15 minutes and try again." }),
    publicForm: limiter({ windowMinutes: 60, max: 30, message: "Too many requests. Please try again later." }),
  };
}

module.exports = { makeLimiters };
