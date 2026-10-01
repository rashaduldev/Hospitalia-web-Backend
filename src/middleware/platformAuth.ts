const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { error } = require("../utils/apiResponse");
const { controlModels } = require("../control/models");

function platformSecret() {
  const secret = env.platformJwtSecret || (env.nodeEnv !== "production" ? "development-platform-secret-change-me" : "");
  if (secret.length < 32) {
    throw Object.assign(new Error("PLATFORM_JWT_SECRET must contain at least 32 characters"), { statusCode: 503 });
  }
  return secret;
}

async function requirePlatformAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return error(res, "Platform authentication required", 401);
  try {
    const decoded = jwt.verify(header.slice(7), platformSecret(), {
      issuer: "hospitalia-control-plane",
      audience: "hospitalia-platform-admin",
    });
    const { PlatformUser } = await controlModels();
    const user = await PlatformUser.findOne({ id: decoded.sub }).lean();
    if (!user || user.status !== "ACTIVE" || Number(user.tokenVersion || 0) !== Number(decoded.tv || 0)) {
      return error(res, "Platform authentication required", 401);
    }
    req.platformUser = user;
    return next();
  } catch (err) {
    if (err?.statusCode === 503) return next(err);
    return error(res, "Platform authentication required", 401);
  }
}

function requirePlatformRole(...roles) {
  return (req, res, next) => {
    if (!req.platformUser || !roles.includes(req.platformUser.role)) {
      return error(res, "Platform permission denied", 403);
    }
    return next();
  };
}

module.exports = { platformSecret, requirePlatformAuth, requirePlatformRole };
