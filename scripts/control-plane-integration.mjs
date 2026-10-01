import "dotenv/config";
import crypto from "node:crypto";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const baseUrl = (process.argv[2] || "http://localhost:5102").replace(/\/$/, "");
if (!baseUrl.includes("localhost")) throw new Error("Control-plane integration tests are restricted to localhost");

const mongoUri = process.env.CONTROL_PLANE_MONGODB_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("CONTROL_PLANE_MONGODB_URI or MONGODB_URI is required");

const tag = `control-test-${Date.now()}`;
const password = "ControlPlane!2468";
const ids = { users: [], tenants: [], domains: [], plans: [], subscriptions: [], invoices: [], payments: [], audits: [] };
let passed = 0;

async function request(name, method, path, { token, body, expected = [200, 201] } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!expected.includes(response.status)) {
    throw new Error(`${name}: expected ${expected.join("/")}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  if (!response.headers.get("x-request-id")) throw new Error(`${name}: missing X-Request-Id`);
  passed += 1;
  return data;
}

const connection = await mongoose.createConnection(mongoUri).asPromise();
const db = connection.db;

try {
  const adminId = crypto.randomUUID();
  const supportId = crypto.randomUUID();
  ids.users.push(adminId, supportId);
  await db.collection("cp_platform_users").insertMany([
    {
      id: adminId,
      name: "Control Test Admin",
      email: `${tag}-admin@example.com`,
      passwordHash: await bcrypt.hash(password, 12),
      role: "PLATFORM_SUPER_ADMIN",
      status: "ACTIVE",
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: supportId,
      name: "Control Test Support",
      email: `${tag}-support@example.com`,
      passwordHash: await bcrypt.hash(password, 12),
      role: "PLATFORM_SUPPORT",
      status: "ACTIVE",
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await request("anonymous tenant list denied", "GET", "/api/platform/tenants", { expected: [401] });
  const adminLogin = await request("platform admin sign-in", "POST", "/api/platform/auth/sign-in", {
    body: { email: `${tag}-admin@example.com`, password },
  });
  const adminToken = adminLogin.payload.accessToken;
  await request("platform me", "GET", "/api/platform/me", { token: adminToken });

  const supportLogin = await request("platform support sign-in", "POST", "/api/platform/auth/sign-in", {
    body: { email: `${tag}-support@example.com`, password },
  });
  await request("support cannot list tenants", "GET", "/api/platform/tenants", {
    token: supportLogin.payload.accessToken,
    expected: [403],
  });

  await request("invalid tenant rejected", "POST", "/api/platform/tenants", {
    token: adminToken,
    body: { slug: "NOT VALID" },
    expected: [422],
  });
  const tenant = await request("tenant create", "POST", "/api/platform/tenants", {
    token: adminToken,
    body: {
      slug: tag,
      legalName: "Control Test Hospital Limited",
      displayName: "Control Test Hospital",
      timezone: "Asia/Dhaka",
      currency: "BDT",
    },
  });
  ids.tenants.push(tenant.payload.id);
  const domain = await db.collection("cp_tenant_domains").findOne({ tenantId: tenant.payload.id });
  ids.domains.push(domain.id);
  await request("duplicate tenant rejected", "POST", "/api/platform/tenants", {
    token: adminToken,
    body: {
      slug: tag,
      legalName: "Duplicate Hospital",
      displayName: "Duplicate Hospital",
    },
    expected: [409],
  });

  const plan = await request("plan create", "POST", "/api/platform/plans", {
    token: adminToken,
    body: {
      code: `LAUNCH_${Date.now()}`,
      name: "Launch Plan",
      billingInterval: "MONTHLY",
      amountMinor: 250000,
      currency: "BDT",
      setupFeeMinor: 1000000,
      trialDays: 7,
      gracePeriodDays: 7,
      entitlements: { appointments: true, reports: true },
      limits: { doctors: 20, staff: 50, locations: 5, monthlyAppointments: 5000 },
    },
  });
  ids.plans.push(plan.payload.id);
  await request("plan list", "GET", "/api/platform/plans", { token: adminToken });

  const subscription = await request("subscription create", "POST", "/api/platform/subscriptions", {
    token: adminToken,
    body: { tenantId: tenant.payload.id, planId: plan.payload.id },
  });
  ids.subscriptions.push(subscription.payload.id);
  if (subscription.payload.status !== "TRIALING" || subscription.payload.priceSnapshot.amountMinor !== 250000) {
    throw new Error("subscription snapshot or trial state is incorrect");
  }
  passed += 1;
  await request("duplicate active subscription rejected", "POST", "/api/platform/subscriptions", {
    token: adminToken,
    body: { tenantId: tenant.payload.id, planId: plan.payload.id },
    expected: [409],
  });
  const tenantDetail = await request("tenant detail", "GET", `/api/platform/tenants/${tenant.payload.id}`, { token: adminToken });
  if (tenantDetail.payload.subscription?.id !== subscription.payload.id || tenantDetail.payload.domains.length !== 1) {
    throw new Error("tenant detail did not include its domain and subscription");
  }
  passed += 1;
  await request("subscription list", "GET", `/api/platform/subscriptions?tenantId=${tenant.payload.id}`, { token: adminToken });

  const invoice = await request("invoice create", "POST", "/api/platform/invoices", {
    token: adminToken,
    body: {
      tenantId: tenant.payload.id,
      subscriptionId: subscription.payload.id,
      currency: "BDT",
      lineItems: [{ description: "Monthly subscription", quantity: 1, unitAmountMinor: 250000 }],
    },
  });
  ids.invoices.push(invoice.payload.id);
  await request("invoice issue", "POST", `/api/platform/invoices/${invoice.payload.id}/issue`, { token: adminToken, body: {} });
  const payment = await request("payment submit", "POST", `/api/platform/invoices/${invoice.payload.id}/payments`, {
    token: adminToken,
    body: {
      method: "BKASH",
      providerReference: `BKASH-${Date.now()}`,
      amountMinor: 250000,
      currency: "BDT",
      idempotencyKey: `control-payment-${Date.now()}`,
    },
  });
  ids.payments.push(payment.payload.id);
  const verified = await request("payment verify", "POST", `/api/platform/payments/${payment.payload.id}/verify`, { token: adminToken, body: {} });
  if (verified.payload.status !== "VERIFIED") throw new Error("payment was not verified");
  passed += 1;
  const paidInvoice = await db.collection("cp_invoices").findOne({ id: invoice.payload.id });
  if (paidInvoice?.status !== "PAID") throw new Error("fully paid invoice was not marked paid");
  passed += 1;
  const pdfResponse = await fetch(`${baseUrl}/api/platform/invoices/${invoice.payload.id}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdfResponse.status !== 200 || pdfResponse.headers.get("content-type") !== "application/pdf" || new TextDecoder().decode(pdfBytes.slice(0, 4)) !== "%PDF") {
    throw new Error("invoice PDF endpoint did not return a valid PDF document");
  }
  passed += 1;
  await request("subscription suspension reason required", "POST", `/api/platform/subscriptions/${subscription.payload.id}/suspend`, { token: adminToken, body: {}, expected: [422] });
  const suspensionReason = "Subscription payment remains overdue after the grace period.";
  await request("subscription suspend", "POST", `/api/platform/subscriptions/${subscription.payload.id}/suspend`, { token: adminToken, body: { reason: suspensionReason } });
  const suspendedSubscription = await db.collection("cp_subscriptions").findOne({ id: subscription.payload.id });
  if (suspendedSubscription?.suspensionReason !== suspensionReason || !suspendedSubscription?.suspendedAt || suspendedSubscription?.suspendedBy !== adminId) {
    throw new Error("subscription suspension metadata was not stored");
  }
  passed += 1;
  await request("subscription reactivate", "POST", `/api/platform/subscriptions/${subscription.payload.id}/reactivate`, { token: adminToken, body: {} });
  const reactivatedSubscription = await db.collection("cp_subscriptions").findOne({ id: subscription.payload.id });
  if (reactivatedSubscription?.suspensionReason || reactivatedSubscription?.suspendedAt || reactivatedSubscription?.suspendedBy) {
    throw new Error("subscription suspension metadata was not cleared on reactivation");
  }
  passed += 1;

  const audits = await db.collection("cp_audit_events").find({ tenantId: tenant.payload.id }).toArray();
  ids.audits.push(...audits.map((item) => item.id));
  if (!audits.some((item) => item.action === "TENANT_CREATED")
    || !audits.some((item) => item.action === "SUBSCRIPTION_CREATED")
    || !audits.some((item) => item.action === "INVOICE_PDF_DOWNLOADED")
    || !audits.some((item) => item.action === "SUBSCRIPTION_SUSPENDED" && item.metadata?.reason === suspensionReason)) {
    throw new Error("required tenant/subscription/invoice audit events were not written");
  }
  passed += 1;

  console.log(`Control-plane integration: ${passed}/${passed} passed against ${baseUrl}`);
} finally {
  await Promise.all([
    db.collection("cp_audit_events").deleteMany({ $or: [{ id: { $in: ids.audits } }, { tenantId: { $in: ids.tenants } }] }),
    db.collection("cp_payments").deleteMany({ id: { $in: ids.payments } }),
    db.collection("cp_invoices").deleteMany({ id: { $in: ids.invoices } }),
    db.collection("cp_subscriptions").deleteMany({ id: { $in: ids.subscriptions } }),
    db.collection("cp_tenant_domains").deleteMany({ id: { $in: ids.domains } }),
    db.collection("cp_tenants").deleteMany({ id: { $in: ids.tenants } }),
    db.collection("cp_plans").deleteMany({ id: { $in: ids.plans } }),
    db.collection("cp_platform_users").deleteMany({ id: { $in: ids.users } }),
  ]);
  await connection.close();
}

