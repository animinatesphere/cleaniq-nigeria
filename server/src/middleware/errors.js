// One error handler for the whole API: clear JSON messages, no stack traces in production.

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // e.g. { field: "message" } for form errors
  }
}

const badRequest = (message, details) => new HttpError(400, message, details);
const notFound = (message = "Not found") => new HttpError(404, message);

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

function makeErrorHandler(config) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    let status = err.status || err.statusCode || 500;
    let message = err.message || "Something went wrong";
    let details = err.details;

    if (err.type === "entity.too.large") {
      status = 413;
      message = "Request is too large";
    } else if (err.type === "entity.parse.failed") {
      status = 400;
      message = "Request body is not valid JSON";
    } else if (err.name === "ValidationError" && err.errors) {
      status = 400;
      message = "Please check the details and try again";
      details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    } else if (err.name === "CastError") {
      status = 400;
      message = "Invalid id";
    } else if (err.code === 11000) {
      status = 409;
      message = "That already exists";
    }

    if (status >= 500) {
      if (!config.isTest) console.error(err);
      if (config.isProduction) message = "Something went wrong on our side. Please try again.";
    }

    const body = { error: message };
    if (details) body.details = details;
    if (!config.isProduction && status >= 500 && err.stack) body.stack = err.stack;
    res.status(status).json(body);
  };
}

module.exports = { HttpError, badRequest, notFound, notFoundHandler, makeErrorHandler };
