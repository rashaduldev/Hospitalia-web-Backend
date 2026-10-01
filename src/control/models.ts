const mongoose = require("mongoose");
const { connectControlPlane } = require("./db");

const options = { timestamps: true, strict: true };

const platformUserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["PLATFORM_SUPER_ADMIN", "PLATFORM_SUPPORT"], required: true },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
  tokenVersion: { type: Number, default: 0 },
  lastLoginAt: Date,
}, options);

const tenantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  legalName: { type: String, required: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["PROVISIONING", "ACTIVE", "SUSPENDED", "OFFBOARDING", "CLOSED"],
    default: "PROVISIONING",
    index: true,
  },
  databaseAlias: { type: String, required: true, unique: true, select: false },
  defaultLocale: { type: String, default: "en" },
  timezone: { type: String, default: "Asia/Dhaka" },
  currency: { type: String, default: "BDT" },
  primaryDomain: { type: String, lowercase: true, trim: true },
  onboardingStatus: { type: String, enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"], default: "NOT_STARTED" },
}, options);

const tenantDomainSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  hostname: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  type: { type: String, enum: ["PLATFORM_SUBDOMAIN", "CUSTOM"], required: true },
  status: { type: String, enum: ["PENDING", "VERIFIED", "ACTIVE", "FAILED"], default: "PENDING" },
  verificationTokenHash: { type: String, select: false },
  verifiedAt: Date,
}, options);

const membershipSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, required: true, index: true },
  platformUserId: { type: String, required: true, index: true },
  role: { type: String, enum: ["OWNER", "TENANT_ADMIN", "BILLING_ADMIN", "STAFF"], required: true },
  status: { type: String, enum: ["INVITED", "ACTIVE", "SUSPENDED", "REVOKED"], default: "INVITED" },
  invitedBy: String,
  invitedAt: Date,
  acceptedAt: Date,
}, options);
membershipSchema.index({ tenantId: 1, platformUserId: 1 }, { unique: true });

const planSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  billingInterval: { type: String, enum: ["MONTHLY", "ANNUAL"], required: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, default: "BDT" },
  setupFeeMinor: { type: Number, min: 0, default: 0 },
  trialDays: { type: Number, min: 0, max: 365, default: 0 },
  gracePeriodDays: { type: Number, min: 0, max: 90, default: 7 },
  entitlements: { type: Map, of: Boolean, default: {} },
  limits: { type: Map, of: Number, default: {} },
  active: { type: Boolean, default: true, index: true },
  version: { type: Number, default: 1 },
}, options);

const subscriptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, required: true },
  activeKey: { type: String, unique: true, sparse: true, select: false },
  planId: { type: String, required: true, index: true },
  planVersion: { type: Number, required: true },
  status: {
    type: String,
    enum: ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"],
    required: true,
    index: true,
  },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  trialEnd: Date,
  graceEndsAt: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  priceSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  entitlementSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  version: { type: Number, default: 1 },
}, options);
subscriptionSchema.index({ tenantId: 1, createdAt: -1 });

const auditEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, index: true },
  actorType: { type: String, enum: ["PLATFORM_USER", "SYSTEM"], required: true },
  actorId: String,
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true },
  targetId: String,
  requestId: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });

async function controlModels() {
  const connection = await connectControlPlane();
  const model = (name, schema, collection) => connection.models[name] || connection.model(name, schema, collection);
  return {
    PlatformUser: model("ControlPlatformUser", platformUserSchema, "cp_platform_users"),
    Tenant: model("ControlTenant", tenantSchema, "cp_tenants"),
    TenantDomain: model("ControlTenantDomain", tenantDomainSchema, "cp_tenant_domains"),
    Membership: model("ControlMembership", membershipSchema, "cp_memberships"),
    Plan: model("ControlPlan", planSchema, "cp_plans"),
    Subscription: model("ControlSubscription", subscriptionSchema, "cp_subscriptions"),
    AuditEvent: model("ControlAuditEvent", auditEventSchema, "cp_audit_events"),
  };
}

module.exports = { controlModels };
