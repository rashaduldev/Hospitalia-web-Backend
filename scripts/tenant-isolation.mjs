import "dotenv/config";
import crypto from "node:crypto";

const baseUrl = (process.argv[2] || "http://localhost:5103").replace(/\/$/, "");
if (!baseUrl.includes("localhost")) throw new Error("Tenant isolation test is restricted to localhost");
const secret = process.env.TENANT_PROXY_SECRET || "local-demo-tenant-proxy-secret-2026-at-least-32";
const password = process.env.DEMO_SEED_PASSWORD || "HospitaliaDemo!2026";
let passed = 0;

function tenantHeaders(hostname, token) {
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${hostname}`).digest("hex");
  return {
    "X-Hospitalia-Tenant-Host": hostname,
    "X-Hospitalia-Tenant-Timestamp": timestamp,
    "X-Hospitalia-Tenant-Signature": signature,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(name, method, path, { hostname, token, body, expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...tenantHeaders(hostname, token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!expected.includes(response.status)) throw new Error(`${name}: ${response.status} ${JSON.stringify(data)}`);
  passed += 1;
  return data;
}

const alphaHost = "hospitalia-demo-alpha.vercel.app";
const betaHost = "hospitalia-demo-beta.vercel.app";
const alpha = await request("alpha search", "GET", "/api/global-search/search?searchType=DOCTOR&city=ALL&pageNo=0&pageSize=10", { hostname: alphaHost });
const beta = await request("beta search", "GET", "/api/global-search/search?searchType=DOCTOR&city=ALL&pageNo=0&pageSize=10", { hostname: betaHost });
if (alpha.payload.content.map((item) => item.name).join(",") !== "Ayesha Rahman") throw new Error("Alpha returned data outside its tenant");
if (beta.payload.content.map((item) => item.name).join(",") !== "Nafis Hossain") throw new Error("Beta returned data outside its tenant");
passed += 2;

const alphaLogin = await request("alpha doctor login", "POST", "/api/auth/sign-in", {
  hostname: alphaHost,
  body: { countryCode: "+880", phoneNumber: "1700000003", password },
});
await request("alpha token works in alpha", "GET", "/api/users/me", { hostname: alphaHost, token: alphaLogin.payload.accessToken });
await request("alpha token denied in beta", "GET", "/api/users/me", {
  hostname: betaHost,
  token: alphaLogin.payload.accessToken,
  expected: [401],
});
await request("alpha identity absent in beta", "POST", "/api/auth/sign-in", {
  hostname: betaHost,
  body: { countryCode: "+880", phoneNumber: "1700000003", password },
  expected: [401],
});
await request("unknown signed tenant denied", "GET", "/api/global-search/search?searchType=DOCTOR&city=ALL&pageNo=0&pageSize=10", {
  hostname: "unknown-hospitalia-demo.vercel.app",
  expected: [404],
});

const alphaAdmin = await request("alpha admin login", "POST", "/api/admin/auth/sign-in", {
  hostname: alphaHost,
  body: { countryCode: "+880", phoneNumber: "1700000001", password },
});
const billing = await request("alpha billing summary", "GET", "/api/tenant/billing/summary", {
  hostname: alphaHost,
  token: alphaAdmin.payload.accessToken,
});
if (billing.payload.tenant.displayName !== "Alpha Care Hospital" || billing.payload.invoices[0]?.status !== "PAID") {
  throw new Error("Alpha billing summary is missing isolated paid invoice data");
}
passed += 1;

console.log(`Tenant isolation integration: ${passed}/${passed} passed against ${baseUrl}`);

