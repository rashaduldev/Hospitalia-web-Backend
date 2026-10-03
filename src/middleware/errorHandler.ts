const { error } = require("../utils/apiResponse");
const env = require("../config/env");

function notFound(req, res) {
  return error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (env.nodeEnv === "production") {
    console.error({
      name: err?.name || "Error",
      code: err?.code,
      statusCode,
      message: err?.code === 11000 ? "Duplicate record" : err?.message || "Request failed",
      cause: err?.cause?.message,
      context: err?.context,
      requestId: req?.id,
      method: req?.method,
      path: req?.originalUrl,
      stack: err?.stack,
    });
  } else {
    console.error(err);
  }
  if (err.name === "ValidationError") {
    return error(res, err.message, 422);
  }
  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyPattern || err.keyValue || {});
    if (duplicateFields.some((field) => ["displayName", "legalName"].includes(field))) {
      return error(res, "A customer with this display or legal name already exists.", 409);
    }
    if (duplicateFields.some((field) => ["slug", "primaryDomain", "hostname"].includes(field))) {
      return error(res, "Domain already exists. Choose a different tenant slug.", 409);
    }
    return error(res, "Duplicate record already exists.", 409);
  }
  const message = statusCode >= 500 && env.nodeEnv === "production" && !err.expose
    ? "Internal server error"
    : (err.message || "Internal server error");
  return error(res, message, statusCode);
}

module.exports = { notFound, errorHandler };

