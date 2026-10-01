const crypto = require("node:crypto");
const env = require("../config/env");
const { controlModels } = require("../control/models");
const { runWithTenant } = require("../tenant/context");
const { error } = require("../utils/apiResponse");

function normalizedHost(value) {
  if (!value) return "";
  try {
    const input = String(value).trim().toLowerCase();
    return (input.includes("://") ? new URL(input).hostname : input.split(",")[0].split(":")[0]).replace(/\.$/, "");
  } catch {
    return "";
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "", "hex");
  const b = Buffer.from(right || "", "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function verifiedProxyHost(req) {
  const host = normalizedHost(req.headers["x-hospitalia-tenant-host"]);
  const timestamp = String(req.headers["x-hospitalia-tenant-timestamp"] || "");
  const signature = String(req.headers["x-hospitalia-tenant-signature"] || "");
  if (!host || !timestamp || !signature || !env.tenantProxySecret) return "";
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) return "";
  const expected = crypto.createHmac("sha256", env.tenantProxySecret).update(`${timestamp}.${host}`).digest("hex");
  return safeEqual(signature, expected) ? host : "";
}

function requestHost(req) {
  const proxyHost = verifiedProxyHost(req);
  if (proxyHost) return proxyHost;
  const origin = normalizedHost(req.headers.origin);
  if (origin && origin !== normalizedHost(req.headers.host)) return origin;
  const forwarded = normalizedHost(req.headers["x-forwarded-host"]);
  return forwarded || normalizedHost(req.headers.host);
}

function isPlatformApplicationHost(host) {
  return host === "hospitalia-web.vercel.app"
    || host === "hospitalia-demo-control.vercel.app"
    || host.endsWith("-rashaduldevs-projects.vercel.app");
}

async function resolveTenant(req, res, next) {
  const signedHost = verifiedProxyHost(req);
  const originHost = normalizedHost(req.headers.origin);
  const apiHost = normalizedHost(req.headers.host);
  const platformApplicationRequest = Boolean(originHost && isPlatformApplicationHost(originHost));
  const explicitTenantHost = signedHost || (originHost && originHost !== apiHost && !platformApplicationRequest ? originHost : "");
  const host = explicitTenantHost || (platformApplicationRequest ? apiHost : requestHost(req));
  const { TenantDomain, Tenant, Subscription } = await controlModels();
  const domain = host ? await TenantDomain.findOne({ hostname: host, status: "ACTIVE" }).lean() : null;

  if (!domain) {
    if (explicitTenantHost) return error(res, "Unknown or inactive tenant domain", 404);
    if (platformApplicationRequest || env.allowLegacyTenant) {
      req.tenant = null;
      return runWithTenant({ tenantId: null, databaseName: null, legacy: true }, next);
    }
    return error(res, "Unknown or inactive tenant domain", 404);
  }

  const [tenant, subscription] = await Promise.all([
    Tenant.findOne({ id: domain.tenantId, status: "ACTIVE" }).select("+databaseAlias").lean(),
    Subscription.findOne({ tenantId: domain.tenantId, activeKey: domain.tenantId }).lean(),
  ]);
  if (!tenant) return error(res, "Tenant is not active", 403);
  if (!subscription) return error(res, "An active subscription is required", 402);

  const now = new Date();
  if (["SUSPENDED", "CANCELLED", "EXPIRED"].includes(subscription.status)) {
    return error(res, "Tenant subscription is not active", 402, { subscriptionStatus: subscription.status });
  }
  if (subscription.status === "PAST_DUE" && subscription.graceEndsAt && new Date(subscription.graceEndsAt) < now) {
    return error(res, "Tenant subscription grace period has ended", 402, { subscriptionStatus: subscription.status });
  }

  const context = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    databaseName: tenant.databaseAlias,
    hostname: domain.hostname,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    entitlements: subscription.entitlementSnapshot,
    legacy: false,
  };
  req.tenant = context;
  res.setHeader("X-Hospitalia-Tenant", tenant.slug);
  return runWithTenant(context, next);
}

module.exports = { resolveTenant, requestHost };
