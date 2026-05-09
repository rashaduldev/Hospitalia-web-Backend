const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { error } = require("../utils/apiResponse");
const User = require("../models/User");

async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret);
    req.user = await User.findOne({ id: decoded.sub }).lean();
  } catch (_err) {
    req.user = null;
  }

  return next();
}

async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {});
  if (!req.user) return error(res, "Authentication required", 401);
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, "Authentication required", 401);
    const roleTypes = (req.user.roles || []).map((role) => role.roleType || role.roleName);
    if (roles.length && !roles.some((role) => roleTypes.includes(role) || req.user.userType === role)) {
      return error(res, "You do not have permission to perform this action", 403);
    }
    return next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole };

