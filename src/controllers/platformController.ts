const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { controlModels } = require("../control/models");
const { writeAudit } = require("../control/audit");
const env = require("../config/env");
const { platformSecret } = require("../middleware/platformAuth");
const { success, error, paginated } = require("../utils/apiResponse");

const slug = z.string().trim().toLowerCase().min(3).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const tenantInput = z.object({
  slug,
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(120),
  defaultLocale: z.string().trim().min(2).max(10).default("en"),
  timezone: z.string().trim().min(3).max(80).default("Asia/Dhaka"),
  currency: z.string().trim().toUpperCase().length(3).default("BDT"),
});
const planInput = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(2).max(100),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().trim().toUpperCase().length(3).default("BDT"),
  setupFeeMinor: z.number().int().nonnegative().default(0),
  trialDays: z.number().int().min(0).max(365).default(0),
  gracePeriodDays: z.number().int().min(0).max(90).default(7),
  entitlements: z.record(z.string(), z.boolean()).default({}),
  limits: z.record(z.string(), z.number().int().nonnegative()).default({}),
});
const subscriptionInput = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  startAt: z.coerce.date().optional(),
});

function parsed(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    error(res, "Validation failed", 422, result.error.flatten());
    return null;
  }
  return result.data;
}

function listOptions(req) {
  const page = Math.max(Number(req.query.page || 0) || 0, 0);
  const limit = Math.min(Math.max(Number(req.query.limit || 20) || 20, 1), 100);
  return { page, limit, skip: page * limit };
}

async function signIn(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const { PlatformUser } = await controlModels();
  const user = await PlatformUser.findOne({ email }).select("+passwordHash");
  if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) {
    return error(res, "Invalid platform credentials", 401);
  }
  user.lastLoginAt = new Date();
  await user.save();
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, tv: Number(user.tokenVersion || 0) },
    platformSecret(),
    { expiresIn: "30m", issuer: "hospitalia-control-plane", audience: "hospitalia-platform-admin" },
  );
  return success(res, { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, "Platform login successful");
}

async function me(req, res) {
  const { id, name, email, phone, role, status } = req.platformUser;
  return success(res, { id, name, email, phone, role, status }, "Platform user fetched");
}

async function createTenant(req, res) {
  const body = parsed(tenantInput, req.body, res);
  if (!body) return;
  const { Tenant, TenantDomain } = await controlModels();
  const id = crypto.randomUUID();
  const hostname = `${body.slug}.${env.platformRootDomain}`;
  const tenant = await Tenant.create({ id, ...body, databaseAlias: `tenant_${id.replaceAll("-", "")}`, primaryDomain: hostname });
  try {
    await TenantDomain.create({ id: crypto.randomUUID(), tenantId: id, hostname, type: "PLATFORM_SUBDOMAIN", status: "PENDING" });
  } catch (err) {
    await Tenant.deleteOne({ id });
    throw err;
  }
  await writeAudit(req, { tenantId: id, action: "TENANT_CREATED", targetType: "TENANT", targetId: id, metadata: { slug: body.slug } });
  const payload = tenant.toObject();
  delete payload.databaseAlias;
  return success(res, payload, "Tenant created", 201);
}

async function listTenants(req, res) {
  const { page, limit, skip } = listOptions(req);
  const { Tenant } = await controlModels();
  const [items, total] = await Promise.all([
    Tenant.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Tenant.countDocuments(),
  ]);
  return success(res, paginated(items, page, limit, total), "Tenants fetched");
}

async function getTenant(req, res) {
  const { Tenant, TenantDomain, Subscription } = await controlModels();
  const [tenant, domains, subscription] = await Promise.all([
    Tenant.findOne({ id: req.params.tenantId }).lean(),
    TenantDomain.find({ tenantId: req.params.tenantId }).lean(),
    Subscription.findOne({ tenantId: req.params.tenantId }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!tenant) return error(res, "Tenant not found", 404);
  return success(res, { ...tenant, domains, subscription }, "Tenant fetched");
}

async function createPlan(req, res) {
  const body = parsed(planInput, req.body, res);
  if (!body) return;
  const { Plan } = await controlModels();
  const item = await Plan.create({ id: crypto.randomUUID(), ...body });
  await writeAudit(req, { action: "PLAN_CREATED", targetType: "PLAN", targetId: item.id, metadata: { code: item.code, version: item.version } });
  return success(res, item.toObject(), "Plan created", 201);
}

async function listPlans(req, res) {
  const { Plan } = await controlModels();
  return success(res, await Plan.find().sort({ amountMinor: 1 }).lean(), "Plans fetched");
}

function addInterval(date, interval) {
  const end = new Date(date);
  if (interval === "ANNUAL") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function mapSnapshot(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...value };
}

async function createSubscription(req, res) {
  const body = parsed(subscriptionInput, req.body, res);
  if (!body) return;
  const { Tenant, Plan, Subscription } = await controlModels();
  const [tenant, plan] = await Promise.all([
    Tenant.findOne({ id: body.tenantId }).lean(),
    Plan.findOne({ id: body.planId, active: true }).lean(),
  ]);
  if (!tenant) return error(res, "Tenant not found", 404);
  if (!plan) return error(res, "Active plan not found", 404);
  await Subscription.init();
  if (await Subscription.exists({ activeKey: tenant.id })) {
    return error(res, "Tenant already has an active subscription", 409);
  }
  const start = body.startAt || new Date();
  const trialEnd = plan.trialDays ? new Date(start.getTime() + plan.trialDays * 86400000) : undefined;
  const periodStart = trialEnd || start;
  const item = await Subscription.create({
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    activeKey: tenant.id,
    planId: plan.id,
    planVersion: plan.version,
    status: trialEnd ? "TRIALING" : "ACTIVE",
    currentPeriodStart: start,
    currentPeriodEnd: trialEnd || addInterval(periodStart, plan.billingInterval),
    trialEnd,
    priceSnapshot: {
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      setupFeeMinor: plan.setupFeeMinor,
      billingInterval: plan.billingInterval,
      gracePeriodDays: plan.gracePeriodDays,
      planCode: plan.code,
      planName: plan.name,
      planVersion: plan.version,
    },
    entitlementSnapshot: {
      entitlements: mapSnapshot(plan.entitlements),
      limits: mapSnapshot(plan.limits),
    },
  });
  await writeAudit(req, { tenantId: tenant.id, action: "SUBSCRIPTION_CREATED", targetType: "SUBSCRIPTION", targetId: item.id, metadata: { planId: plan.id, status: item.status } });
  return success(res, item.toObject(), "Subscription created", 201);
}

async function listSubscriptions(req, res) {
  const { page, limit, skip } = listOptions(req);
  const { Subscription } = await controlModels();
  const filter = req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {};
  const [items, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscription.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Subscriptions fetched");
}

module.exports = {
  signIn,
  me,
  createTenant,
  listTenants,
  getTenant,
  createPlan,
  listPlans,
  createSubscription,
  listSubscriptions,
};
