const { error } = require("../utils/apiResponse");

function notFound(req, res) {
  return error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === "ValidationError") {
    return error(res, err.message, 422);
  }
  if (err.code === 11000) {
    return error(res, "Duplicate record already exists", 409);
  }
  return error(res, err.message || "Internal server error", err.statusCode || 500);
}

module.exports = { notFound, errorHandler };
