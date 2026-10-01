import "dotenv/config";
import crypto from "node:crypto";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const baseUrl = (process.argv[2] || "http://localhost:5102").replace(/\/$/, "");
if (!baseUrl.includes("localhost")) throw new Error("Onboarding integration tests are restricted to localhost");
const mongoUri = process.env.CONTROL_PLANE_MONGODB_URI || process.env.MONGODB_URI;
const proxySecret = process.env.TENANT_PROXY_SECRET;
if (!mongoUri || !proxySecret) throw new Error("MONGODB_URI and TENANT_PROXY_SECRET are required");

const tag = `onboarding-${Date.now()}`;
const platformPassword = "ControlPlane!2468";
const ownerPassword = "TenantOwner!2468";
let passed = 0;

async function request(name, method, path, { token, body, tenantHost, expected = [200, 201] } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (tenantHost) {
    const timestamp = String(Date.now());
    headers["X-Hospitalia-Tenant-Host"] = tenantHost;
    headers["X-Hospitalia-Tenant-Timestamp"] = timestamp;
    headers["X-Hospitalia-Tenant-Signature"] = crypto.createHmac("sha256", proxySecret).update(`${timestamp}.${tenantHost}`).digest("hex");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (!expected.includes(response.status)) throw new Error(`${name}: expected ${expected.join("/")}, got ${response.status}: ${JSON.stringify(data)}`);
  passed += 1;
  return data;
}

const connection = await mongoose.createConnection(mongoUri).asPromise();
const db = connection.db;
const platformUserId = crypto.randomUUID();
const planId = crypto.randomUUID();
let tenantId;
let tenantDatabase;

try {
  await db.collection("cp_platform_users").insertOne({
    id: platformUserId, name: "Onboarding Test Admin", email: `${tag}@example.com`,
    passwordHash: await bcrypt.hash(platformPassword, 12), role: "PLATFORM_SUPER_ADMIN", status: "ACTIVE",
    tokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection("cp_plans").insertOne({
    id: planId, code: `ONBOARD_${Date.now()}`, name: "Onboarding Plan", billingInterval: "MONTHLY",
    amountMinor: 200000, setupFeeMinor: 500000, currency: "BDT", trialDays: 0, gracePeriodDays: 7,
    entitlements: { appointments: true }, limits: { doctors: 10 }, active: true, version: 1,
    createdAt: new Date(), updatedAt: new Date(),
  });

  const login = await request("platform login", "POST", "/api/platform/auth/sign-in", {
    body: { email: `${tag}@example.com`, password: platformPassword },
  });
  const token = login.payload.accessToken;
  const hostname = `${tag}.hospitalia.app`;
  const provisioned = await request("complete onboarding", "POST", "/api/platform/tenants/provision", {
    token,
    body: {
      tenant: { slug: tag, legalName: "Onboarding Test Hospital Limited", displayName: "Onboarding Test Hospital", timezone: "Asia/Dhaka", currency: "BDT" },
      owner: { firstName: "Tenant", lastName: "Owner", email: `${tag}-owner@example.com`, countryCode: "+880", mobileNumber: "1603010103", temporaryPassword: ownerPassword },
      planId,
      billing: { collectNow: true, method: "BKASH", providerReference: `TEST-${Date.now()}`, discountMinor: 0, taxMinor: 0 },
      provisionDomain: false,
    },
  });
  tenantId = provisioned.payload.tenant.id;
  const storedTenant = await db.collection("cp_tenants").findOne({ id: tenantId });
  tenantDatabase = storedTenant.databaseAlias;
  if (storedTenant.status !== "ACTIVE" || storedTenant.onboardingStatus !== "COMPLETED") throw new Error("tenant was not activated");
  if (provisioned.payload.invoice.status !== "PAID" || provisioned.payload.payment.status !== "VERIFIED") throw new Error("billing was not completed");
  passed += 2;

  const tenantDb = connection.useDb(tenantDatabase);
  const owner = await tenantDb.collection("users").findOne({ userType: "ADMIN" });
  if (!owner || owner.passwordHash === ownerPassword || owner.mobileNumber !== "1603010103") throw new Error("owner bootstrap is invalid");
  passed += 1;
  const adminLogin = await request("tenant admin login", "POST", "/api/admin/auth/sign-in", {
    tenantHost: hostname,
    body: { countryCode: "+880", phoneNumber: "1603010103", password: ownerPassword },
  });
  if (!adminLogin.payload.accessToken) throw new Error("tenant admin token missing");
  passed += 1;

  await request("completed tenant cannot duplicate", "POST", "/api/platform/tenants/provision", {
    token,
    body: {
      tenant: { slug: tag, legalName: "Onboarding Test Hospital Limited", displayName: "Onboarding Test Hospital", timezone: "Asia/Dhaka", currency: "BDT" },
      owner: { firstName: "Tenant", lastName: "Owner", email: `${tag}-owner@example.com`, countryCode: "+880", mobileNumber: "1603010103", temporaryPassword: ownerPassword },
      planId, billing: { collectNow: true, method: "BKASH", providerReference: "DUPLICATE" }, provisionDomain: false,
    },
    expected: [409],
  });
  const invoices = await db.collection("cp_invoices").countDocuments({ tenantId });
  const payments = await db.collection("cp_payments").countDocuments({ tenantId });
  if (invoices !== 1 || payments !== 1) throw new Error("idempotency guard allowed duplicate billing records");
  passed += 1;

  console.log(`Onboarding integration: ${passed}/${passed} passed against ${baseUrl}`);
} finally {
  if (tenantDatabase && /^tenant_[a-f0-9]{30}$/.test(tenantDatabase)) await connection.useDb(tenantDatabase).dropDatabase();
  if (tenantId) {
    await Promise.all([
      db.collection("cp_audit_events").deleteMany({ tenantId }),
      db.collection("cp_payments").deleteMany({ tenantId }),
      db.collection("cp_invoices").deleteMany({ tenantId }),
      db.collection("cp_subscriptions").deleteMany({ tenantId }),
      db.collection("cp_tenant_domains").deleteMany({ tenantId }),
      db.collection("cp_tenants").deleteMany({ id: tenantId }),
    ]);
  }
  await Promise.all([
    db.collection("cp_plans").deleteMany({ id: planId }),
    db.collection("cp_platform_users").deleteMany({ id: platformUserId }),
  ]);
  await connection.close();
}
