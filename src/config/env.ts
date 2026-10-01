const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5001),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hospitalia",
  controlPlaneMongoUri: process.env.CONTROL_PLANE_MONGODB_URI || "",
  platformJwtSecret: process.env.PLATFORM_JWT_SECRET || "",
  platformRootDomain: (process.env.PLATFORM_ROOT_DOMAIN || "hospitalia.app").trim().toLowerCase(),
  tenantProxySecret: process.env.TENANT_PROXY_SECRET || "",
  allowLegacyTenant: String(process.env.ALLOW_LEGACY_TENANT ?? "true").toLowerCase() === "true",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "3d",
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
};

if (env.nodeEnv === "production") {
  const unsafeSecret = (value) =>
    value.length < 32 || /^(dev-|change-|replace-|secret$)/i.test(value);
  if (
    unsafeSecret(env.jwtAccessSecret)
    || unsafeSecret(env.jwtRefreshSecret)
    || env.jwtAccessSecret === env.jwtRefreshSecret
  ) {
    throw new Error("Unique JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values of at least 32 characters are required in production");
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required in production");
  }
  if (env.tenantProxySecret && env.tenantProxySecret.length < 32) {
    throw new Error("TENANT_PROXY_SECRET must contain at least 32 characters when configured");
  }
}

module.exports = env;

