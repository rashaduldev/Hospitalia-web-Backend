const { error } = require("../utils/apiResponse");
const env = require("../config/env");

function notFound(req, res) {
  return error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, _req, res, _next) {
  if (env.nodeEnv === "production") {
    console.error({
      name: err?.name || "Error",
      code: err?.code,
      statusCode: err?.statusCode || 500,
      message: err?.code === 11000 ? "Duplicate record" : "Request failed",
    });
  } else {
    console.error(err);
  }
  if (err.name === "ValidationError") {
    return error(res, err.message, 422);
  }
  if (err.code === 11000) {
    return error(res, "Duplicate record already exists", 409);
  }
  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 && env.nodeEnv === "production"
    ? "Internal server error"
    : (err.message || "Internal server error");
  return error(res, message, statusCode);
}

module.exports = { notFound, errorHandler };

