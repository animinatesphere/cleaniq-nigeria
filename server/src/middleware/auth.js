// Login checks. Admin tokens use ADMIN_JWT_SECRET; customer and worker tokens use JWT_SECRET with
// their own "typ", so one kind of token can never be used as another.
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const Worker = require("../models/Worker");
const { HttpError } = require("./errors");

const ADMIN_TTL = "12h";
const CUSTOMER_TTL = "30d";
const WORKER_TTL = "30d";

function bearer(req) {
  const h = req.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

function signAdmin(config, admin) {
  return jwt.sign({ typ: "admin", role: admin.role }, config.adminJwtSecret, { subject: String(admin._id), expiresIn: ADMIN_TTL });
}
function signCustomer(config, customer) {
  return jwt.sign({ typ: "customer" }, config.jwtSecret, { subject: String(customer._id), expiresIn: CUSTOMER_TTL });
}
function signWorker(config, worker) {
  return jwt.sign({ typ: "worker" }, config.jwtSecret, { subject: String(worker._id), expiresIn: WORKER_TTL });
}

function verify(token, secret, typ) {
  try {
    const payload = jwt.verify(token, secret);
    return payload.typ === typ ? payload : null;
  } catch {
    return null;
  }
}

// requireAdmin() → any active admin; requireAdmin("owner", "manager") → only those roles.
function makeRequireAdmin(config) {
  return (...roles) =>
    async function requireAdmin(req, res, next) {
      const token = bearer(req);
      const payload = token && verify(token, config.adminJwtSecret, "admin");
      if (!payload) return next(new HttpError(401, "Please log in to the admin"));
      const admin = await Admin.findById(payload.sub).lean();
      if (!admin || !admin.active) return next(new HttpError(401, "Please log in to the admin"));
      if (roles.length && !roles.includes(admin.role)) return next(new HttpError(403, "You don't have permission to do that"));
      req.admin = admin;
      next();
    };
}

function makeRequireCustomer(config) {
  return async function requireCustomer(req, res, next) {
    const token = bearer(req);
    const payload = token && verify(token, config.jwtSecret, "customer");
    if (!payload) return next(new HttpError(401, "Please log in"));
    const customer = await Customer.findById(payload.sub).lean();
    if (!customer) return next(new HttpError(401, "Please log in"));
    req.customer = customer;
    next();
  };
}

function makeRequireWorker(config) {
  return async function requireWorker(req, res, next) {
    const token = bearer(req);
    const payload = token && verify(token, config.jwtSecret, "worker");
    if (!payload) return next(new HttpError(401, "Please log in"));
    const worker = await Worker.findById(payload.sub).lean();
    if (!worker || worker.status !== "active") return next(new HttpError(401, "Please log in"));
    req.worker = worker;
    Worker.updateOne({ _id: worker._id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
    next();
  };
}

function makeAuth(config) {
  return {
    requireAdmin: makeRequireAdmin(config),
    requireCustomer: makeRequireCustomer(config),
    requireWorker: makeRequireWorker(config),
    signAdmin: (a) => signAdmin(config, a),
    signCustomer: (c) => signCustomer(config, c),
    signWorker: (w) => signWorker(config, w),
  };
}

module.exports = { makeAuth };
