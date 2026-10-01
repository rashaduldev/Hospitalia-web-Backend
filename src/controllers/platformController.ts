const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { controlModels } = require("../control/models");
const { writeAudit } = require("../control/audit");
const env = require("../config/env");
const User = require("../models/User");
const Counter = require("../models/Counter");
const { runWithTenant } = require("../tenant/context");
const { assignTenantAlias } = require("../services/vercelDomainService");
const { renderInvoicePdf } = require("../services/invoicePdfService");
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
const invoiceInput = z.object({
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  currency: z.string().trim().toUpperCase().length(3),
  discountMinor: z.number().int().nonnegative().default(0),
  taxMinor: z.number().int().nonnegative().default(0),
  dueAt: z.coerce.date().optional(),
  lineItems: z.array(z.object({
    description: z.string().trim().min(2).max(200),
    quantity: z.number().int().min(1).max(1000),
    unitAmountMinor: z.number().int().nonnegative(),
  })).min(1).max(50),
});
const paymentInput = z.object({
  method: z.enum(["BANK", "BKASH", "NAGAD", "CASH", "OTHER"]),
  providerReference: z.string().trim().min(2).max(120),
  amountMinor: z.number().int().positive(),
  currency: z.string().trim().toUpperCase().length(3),
  idempotencyKey: z.string().trim().min(8).max(120),
  receivedAt: z.coerce.date().optional(),
});
const rejectionInput = z.object({ reason: z.string().trim().min(3).max(300) });
const suspensionInput = z.object({ reason: z.string().trim().min(5).max(500) });
const strongPassword = z.string().min(10).max(72)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");
const onboardingInput = z.object({
  tenant: tenantInput,
  owner: z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().max(80).default(""),
    email: z.string().trim().toLowerCase().email().max(160),
    countryCode: z.string().trim().regex(/^\+[1-9]\d{0,3}$/),
    mobileNumber: z.string().trim().regex(/^\d{7,15}$/),
    temporaryPassword: strongPassword,
  }),
  planId: z.string().uuid(),
  billing: z.object({
    collectNow: z.boolean().default(false),
    method: z.enum(["BANK", "BKASH", "NAGAD", "CASH", "OTHER"]).default("BANK"),
    providerReference: z.string().trim().max(120).default(""),
    discountMinor: z.number().int().nonnegative().default(0),
    taxMinor: z.number().int().nonnegative().default(0),
  }).default({}),
  provisionDomain: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.billing.collectNow && value.billing.providerReference.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["billing", "providerReference"], message: "Payment reference is required" });
  }
  if (env.nodeEnv === "production" && !value.provisionDomain) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provisionDomain"], message: "Production domains must be provisioned automatically" });
  }
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

function subscriptionDocument(tenant, plan, start = new Date()) {
  const trialEnd = plan.trialDays ? new Date(start.getTime() + plan.trialDays * 86400000) : undefined;
  return {
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    activeKey: tenant.id,
    planId: plan.id,
    planVersion: plan.version,
    status: trialEnd ? "TRIALING" : "ACTIVE",
    currentPeriodStart: start,
    currentPeriodEnd: trialEnd || addInterval(start, plan.billingInterval),
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
  };
}

async function bootstrapTenantOwner(tenant, owner) {
  const mobileNumber = owner.mobileNumber.replace(/^0+/, "");
  return runWithTenant(
    { tenantId: tenant.id, tenantSlug: tenant.slug, databaseName: tenant.databaseAlias },
    async () => {
      await Promise.all([User.init(), Counter.init()]);
      const existing = await User.findOne({
        $or: [
          { countryCode: owner.countryCode, mobileNumber },
          { email: owner.email },
        ],
      });
      if (existing) {
        if (existing.userType !== "ADMIN") {
          throw Object.assign(new Error("The owner email or phone is already used by a non-admin account"), { statusCode: 409 });
        }
        existing.firstName = owner.firstName;
        existing.lastName = owner.lastName;
        existing.email = owner.email;
        existing.countryCode = owner.countryCode;
        existing.mobileNumber = mobileNumber;
        existing.passwordHash = await bcrypt.hash(owner.temporaryPassword, 12);
        existing.status = "ACTIVE";
        existing.roles = [{ roleName: "TENANT_ADMIN", roleType: "SUPER_ADMIN" }];
        await existing.save();
        return existing;
      }
      const counter = await Counter.findOneAndUpdate(
        { name: "users" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      return User.create({
        id: counter.seq,
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        countryCode: owner.countryCode,
        mobileNumber,
        passwordHash: await bcrypt.hash(owner.temporaryPassword, 12),
        userType: "ADMIN",
        status: "ACTIVE",
        roles: [{ roleName: "TENANT_ADMIN", roleType: "SUPER_ADMIN" }],
      });
    },
  );
}

async function provisionTenant(req, res) {
  const body = parsed(onboardingInput, req.body, res);
  if (!body) return;
  const { Tenant, TenantDomain, Plan, Subscription, Invoice, Payment } = await controlModels();
  const plan = await Plan.findOne({ id: body.planId, active: true }).lean();
  if (!plan) return error(res, "Active plan not found", 404);

  const hostname = `${body.tenant.slug}.${env.platformRootDomain}`;
  let tenant = await Tenant.findOne({ slug: body.tenant.slug }).select("+databaseAlias");
  if (!tenant) {
    const id = crypto.randomUUID();
    tenant = await Tenant.create({
      id,
      ...body.tenant,
      databaseAlias: `tenant_${id.replaceAll("-", "").slice(0, 30)}`,
      primaryDomain: hostname,
      onboardingStatus: "IN_PROGRESS",
      owner: {
        name: `${body.owner.firstName} ${body.owner.lastName}`.trim(),
        email: body.owner.email,
        phone: `${body.owner.countryCode}${body.owner.mobileNumber.replace(/^0+/, "")}`,
      },
    });
    await writeAudit(req, { tenantId: id, action: "TENANT_CREATED", targetType: "TENANT", targetId: id, metadata: { slug: body.tenant.slug, source: "ONBOARDING" } });
  } else {
    tenant.onboardingStatus = "IN_PROGRESS";
    tenant.owner = {
      name: `${body.owner.firstName} ${body.owner.lastName}`.trim(),
      email: body.owner.email,
      phone: `${body.owner.countryCode}${body.owner.mobileNumber.replace(/^0+/, "")}`,
    };
    await tenant.save();
  }

  let domain = await TenantDomain.findOne({ tenantId: tenant.id });
  if (!domain) {
    domain = await TenantDomain.create({
      id: crypto.randomUUID(), tenantId: tenant.id, hostname, type: "PLATFORM_SUBDOMAIN", status: "PENDING",
    });
  }

  const ownerUser = await bootstrapTenantOwner(tenant, body.owner);

  await Subscription.init();
  let subscription = await Subscription.findOne({ tenantId: tenant.id, status: { $in: ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED"] } });
  if (!subscription) subscription = await Subscription.create(subscriptionDocument(tenant, plan));

  let invoice = await Invoice.findOne({ tenantId: tenant.id, subscriptionId: subscription.id }).sort({ createdAt: -1 });
  if (!invoice) {
    const lineItems = [
      { description: `${plan.name} subscription`, quantity: 1, unitAmountMinor: plan.amountMinor, totalMinor: plan.amountMinor },
      ...(plan.setupFeeMinor ? [{ description: "One-time setup fee", quantity: 1, unitAmountMinor: plan.setupFeeMinor, totalMinor: plan.setupFeeMinor }] : []),
    ];
    const subtotalMinor = lineItems.reduce((sum, item) => sum + item.totalMinor, 0);
    const totalMinor = subtotalMinor - body.billing.discountMinor + body.billing.taxMinor;
    if (totalMinor < 0) return error(res, "Invoice total cannot be negative", 422);
    const now = new Date();
    invoice = await Invoice.create({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      invoiceNumber: `INV-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      status: "ISSUED",
      lineItems,
      subtotalMinor,
      discountMinor: body.billing.discountMinor,
      taxMinor: body.billing.taxMinor,
      totalMinor,
      currency: plan.currency,
      issuedAt: now,
      dueAt: new Date(now.getTime() + plan.gracePeriodDays * 86400000),
    });
  }

  let payment = null;
  if (body.billing.collectNow && invoice.totalMinor > 0) {
    const idempotencyKey = `onboarding:${tenant.id}:${invoice.id}`;
    payment = await Payment.findOne({ tenantId: tenant.id, idempotencyKey });
    if (!payment) {
      payment = await Payment.create({
        id: crypto.randomUUID(), tenantId: tenant.id, invoiceId: invoice.id,
        method: body.billing.method, providerReference: body.billing.providerReference,
        amountMinor: invoice.totalMinor, currency: invoice.currency, status: "VERIFIED",
        idempotencyKey, receivedAt: new Date(), verifiedAt: new Date(), verifiedBy: req.platformUser.id,
      });
    }
    if (invoice.status !== "PAID") {
      invoice.status = "PAID";
      invoice.paidAt = new Date();
      await invoice.save();
    }
  }

  const infrastructure = body.provisionDomain
    ? await assignTenantAlias(hostname)
    : { hostname, deployment: null, aliasId: null, skipped: true };

  domain.status = "ACTIVE";
  domain.verifiedAt = new Date();
  await domain.save();
  tenant.status = "ACTIVE";
  tenant.onboardingStatus = "COMPLETED";
  await tenant.save();

  await writeAudit(req, {
    tenantId: tenant.id,
    action: "TENANT_PROVISIONED",
    targetType: "TENANT",
    targetId: tenant.id,
    metadata: { planId: plan.id, subscriptionId: subscription.id, invoiceId: invoice.id, paymentId: payment?.id || null, hostname },
  });

  const payload = tenant.toObject();
  delete payload.databaseAlias;
  return success(res, {
    tenant: payload,
    domain: domain.toObject(),
    subscription: subscription.toObject(),
    invoice: invoice.toObject(),
    payment: payment?.toObject() || null,
    owner: {
      userId: ownerUser.id,
      name: `${ownerUser.firstName} ${ownerUser.lastName}`.trim(),
      email: ownerUser.email,
      countryCode: ownerUser.countryCode,
      mobileNumber: ownerUser.mobileNumber,
      temporaryPassword: body.owner.temporaryPassword,
    },
    infrastructure,
    loginUrl: `https://${hostname}/en/admin/login`,
  }, "Tenant onboarding completed", 201);
}

async function createTenant(req, res) {
  const body = parsed(tenantInput, req.body, res);
  if (!body) return;
  const { Tenant, TenantDomain } = await controlModels();
  const id = crypto.randomUUID();
  const hostname = `${body.slug}.${env.platformRootDomain}`;
  const tenant = await Tenant.create({ id, ...body, databaseAlias: `tenant_${id.replaceAll("-", "").slice(0, 30)}`, primaryDomain: hostname });
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

async function changeSubscriptionStatus(req, res, targetStatus, context: { reason?: string } = {}) {
  const { Subscription } = await controlModels();
  const allowedFrom = targetStatus === "ACTIVE"
    ? ["SUSPENDED", "PAST_DUE"]
    : targetStatus === "SUSPENDED"
      ? ["TRIALING", "ACTIVE", "PAST_DUE"]
      : ["TRIALING", "ACTIVE", "PAST_DUE", "SUSPENDED"];
  const update = targetStatus === "CANCELLED"
    ? { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelAtPeriodEnd: false }, $unset: { activeKey: 1, graceEndsAt: 1 } }
    : targetStatus === "SUSPENDED"
      ? { $set: { status: targetStatus, suspendedAt: new Date(), suspendedBy: req.platformUser.id, suspensionReason: context.reason }, $unset: { graceEndsAt: 1 } }
      : { $set: { status: targetStatus }, $unset: { graceEndsAt: 1, suspendedAt: 1, suspendedBy: 1, suspensionReason: 1 } };
  const item = await Subscription.findOneAndUpdate(
    { id: req.params.id, status: { $in: allowedFrom } },
    update,
    { new: true },
  );
  if (!item) return error(res, "Subscription cannot make this transition", 409);
  await writeAudit(req, {
    tenantId: item.tenantId,
    action: `SUBSCRIPTION_${targetStatus}`,
    targetType: "SUBSCRIPTION",
    targetId: item.id,
    metadata: { status: targetStatus, ...(context.reason ? { reason: context.reason } : {}) },
  });
  return success(res, item.toObject(), `Subscription ${targetStatus.toLowerCase()}`);
}

async function suspendSubscription(req, res) {
  const body = parsed(suspensionInput, req.body, res);
  if (!body) return;
  return changeSubscriptionStatus(req, res, "SUSPENDED", body);
}

async function reactivateSubscription(req, res) {
  return changeSubscriptionStatus(req, res, "ACTIVE");
}

async function cancelSubscription(req, res) {
  return changeSubscriptionStatus(req, res, "CANCELLED");
}

async function createInvoice(req, res) {
  const body = parsed(invoiceInput, req.body, res);
  if (!body) return;
  const { Tenant, Subscription, Invoice } = await controlModels();
  const [tenant, subscription] = await Promise.all([
    Tenant.findOne({ id: body.tenantId }).lean(),
    Subscription.findOne({ id: body.subscriptionId, tenantId: body.tenantId }).lean(),
  ]);
  if (!tenant) return error(res, "Tenant not found", 404);
  if (!subscription) return error(res, "Subscription not found", 404);
  const lineItems = body.lineItems.map((item) => ({ ...item, totalMinor: item.quantity * item.unitAmountMinor }));
  const subtotalMinor = lineItems.reduce((sum, item) => sum + item.totalMinor, 0);
  const totalMinor = subtotalMinor - body.discountMinor + body.taxMinor;
  if (totalMinor < 0) return error(res, "Invoice total cannot be negative", 422);
  const invoice = await Invoice.create({
    id: crypto.randomUUID(),
    tenantId: body.tenantId,
    subscriptionId: body.subscriptionId,
    invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    status: "DRAFT",
    lineItems,
    subtotalMinor,
    discountMinor: body.discountMinor,
    taxMinor: body.taxMinor,
    totalMinor,
    currency: body.currency,
    dueAt: body.dueAt,
  });
  await writeAudit(req, { tenantId: body.tenantId, action: "INVOICE_CREATED", targetType: "INVOICE", targetId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber, totalMinor } });
  return success(res, invoice.toObject(), "Invoice created", 201);
}

async function issueInvoice(req, res) {
  const { Invoice } = await controlModels();
  const now = new Date();
  const defaultDue = new Date(now.getTime() + 7 * 86400000);
  const invoice = await Invoice.findOneAndUpdate(
    { id: req.params.id, status: "DRAFT" },
    { $set: { status: "ISSUED", issuedAt: now, dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : defaultDue } },
    { new: true },
  );
  if (!invoice) return error(res, "Only a draft invoice can be issued", 409);
  await writeAudit(req, { tenantId: invoice.tenantId, action: "INVOICE_ISSUED", targetType: "INVOICE", targetId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber } });
  return success(res, invoice.toObject(), "Invoice issued");
}

async function listInvoices(req, res) {
  const { page, limit, skip } = listOptions(req);
  const { Invoice } = await controlModels();
  const filter = req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {};
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Invoices fetched");
}

async function downloadInvoicePdf(req, res) {
  const { Invoice, Tenant, Subscription, Payment } = await controlModels();
  const invoice = await Invoice.findOne({ id: req.params.id }).lean();
  if (!invoice) return error(res, "Invoice not found", 404);
  const [tenant, subscription, payments] = await Promise.all([
    Tenant.findOne({ id: invoice.tenantId }).lean(),
    Subscription.findOne({ id: invoice.subscriptionId, tenantId: invoice.tenantId }).lean(),
    Payment.find({ invoiceId: invoice.id, status: "VERIFIED" }).sort({ verifiedAt: 1 }).lean(),
  ]);
  if (!tenant) return error(res, "Invoice customer not found", 404);
  const amountPaidMinor = payments.reduce((sum, payment) => sum + Number(payment.amountMinor || 0), 0);
  const balanceDueMinor = Math.max(Number(invoice.totalMinor || 0) - amountPaidMinor, 0);
  const generatedAt = new Date();
  const pdf = await renderInvoicePdf({
    invoice: { ...invoice, amountPaidMinor, balanceDueMinor },
    tenant,
    subscription,
    payments,
    generatedAt,
  });
  await writeAudit(req, {
    tenantId: invoice.tenantId,
    action: "INVOICE_PDF_DOWNLOADED",
    targetType: "INVOICE",
    targetId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, generatedAt: generatedAt.toISOString() },
  });
  const safeNumber = String(invoice.invoiceNumber).replace(/[^A-Za-z0-9_-]/g, "-");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${safeNumber}.pdf"`,
    "Content-Length": String(pdf.length),
    "Cache-Control": "private, no-store, max-age=0",
  });
  return res.status(200).end(pdf);
}

async function submitPayment(req, res) {
  const body = parsed(paymentInput, req.body, res);
  if (!body) return;
  const { Invoice, Payment } = await controlModels();
  const invoice = await Invoice.findOne({ id: req.params.id, status: { $in: ["ISSUED", "OVERDUE"] } }).lean();
  if (!invoice) return error(res, "Issued invoice not found", 404);
  if (invoice.currency !== body.currency) return error(res, "Payment currency must match invoice currency", 422);
  const existing = await Payment.findOne({ tenantId: invoice.tenantId, idempotencyKey: body.idempotencyKey }).lean();
  if (existing) return success(res, existing, "Payment already submitted");
  const payment = await Payment.create({
    id: crypto.randomUUID(),
    tenantId: invoice.tenantId,
    invoiceId: invoice.id,
    ...body,
    receivedAt: body.receivedAt || new Date(),
    status: "PENDING",
  });
  await writeAudit(req, { tenantId: invoice.tenantId, action: "PAYMENT_SUBMITTED", targetType: "PAYMENT", targetId: payment.id, metadata: { invoiceId: invoice.id, amountMinor: payment.amountMinor, method: payment.method } });
  return success(res, payment.toObject(), "Payment submitted", 201);
}

async function verifyPayment(req, res) {
  const { Payment, Invoice, Subscription } = await controlModels();
  let payment = await Payment.findOne({ id: req.params.id });
  if (!payment) return error(res, "Payment not found", 404);
  if (payment.status === "VERIFIED") return success(res, payment.toObject(), "Payment already verified");
  if (payment.status !== "PENDING") return error(res, "Only a pending payment can be verified", 409);
  payment.status = "VERIFIED";
  payment.verifiedAt = new Date();
  payment.verifiedBy = req.platformUser.id;
  await payment.save();
  const invoice = await Invoice.findOne({ id: payment.invoiceId });
  const totals = await Payment.aggregate([
    { $match: { invoiceId: payment.invoiceId, status: "VERIFIED" } },
    { $group: { _id: "$invoiceId", total: { $sum: "$amountMinor" } } },
  ]);
  if (invoice && Number(totals[0]?.total || 0) >= Number(invoice.totalMinor)) {
    invoice.status = "PAID";
    invoice.paidAt = new Date();
    await invoice.save();
    await Subscription.updateOne(
      { id: invoice.subscriptionId, status: { $in: ["PAST_DUE", "SUSPENDED"] } },
      { $set: { status: "ACTIVE", activeKey: invoice.tenantId }, $unset: { graceEndsAt: 1 } },
    );
  }
  await writeAudit(req, { tenantId: payment.tenantId, action: "PAYMENT_VERIFIED", targetType: "PAYMENT", targetId: payment.id, metadata: { invoiceId: payment.invoiceId, amountMinor: payment.amountMinor } });
  return success(res, payment.toObject(), "Payment verified");
}

async function rejectPayment(req, res) {
  const body = parsed(rejectionInput, req.body, res);
  if (!body) return;
  const { Payment } = await controlModels();
  const payment = await Payment.findOneAndUpdate(
    { id: req.params.id, status: "PENDING" },
    { status: "REJECTED", rejectedAt: new Date(), rejectedBy: req.platformUser.id, rejectionReason: body.reason },
    { new: true },
  );
  if (!payment) return error(res, "Only a pending payment can be rejected", 409);
  await writeAudit(req, { tenantId: payment.tenantId, action: "PAYMENT_REJECTED", targetType: "PAYMENT", targetId: payment.id, metadata: { reason: body.reason } });
  return success(res, payment.toObject(), "Payment rejected");
}

async function listPayments(req, res) {
  const { page, limit, skip } = listOptions(req);
  const { Payment } = await controlModels();
  const filter = req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Payments fetched");
}

module.exports = {
  signIn,
  me,
  createTenant,
  provisionTenant,
  listTenants,
  getTenant,
  createPlan,
  listPlans,
  createSubscription,
  listSubscriptions,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  createInvoice,
  issueInvoice,
  listInvoices,
  downloadInvoicePdf,
  submitPayment,
  verifyPayment,
  rejectPayment,
  listPayments,
};
