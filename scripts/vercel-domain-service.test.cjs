const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.VERCEL_API_TOKEN = "test-token";
process.env.VERCEL_FRONTEND_DEPLOYMENT = "control.example";
process.env.VERCEL_TEAM_ID = "team_test";

const { assignTenantAlias } = require("../dist/src/services/vercelDomainService.js");

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("assigns only from a READY, reachable deployment and verifies the tenant URL", { concurrency: false }, async () => {
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || "GET" });
    if (requests.length === 1) return jsonResponse({ deployment: { id: "dpl_ready", url: "deploy.example" } });
    if (requests.length === 2) return jsonResponse({ id: "dpl_ready", readyState: "READY", status: "READY" });
    if (requests.length === 3) return new Response(null, { status: 200 });
    if (requests.length === 4) return jsonResponse({ uid: "alias-1" });
    if (requests.length === 5) return jsonResponse({ uid: "alias-1", protectionBypass: { "*": { scope: "alias-protection-override" } } });
    if (requests.length === 6) return new Response(null, { status: 307, headers: { location: "/en" } });
    throw new Error(`Unexpected request ${requests.length}: ${url}`);
  };

  const result = await assignTenantAlias("tenant.example");
  assert.equal(result.deploymentId, "dpl_ready");
  assert.equal(result.aliasId, "alias-1");
  assert.equal(result.sourceReachabilityStatus, 200);
  assert.equal(result.reachabilityStatus, 307);
  assert.equal(requests.length, 6);
});

test("rejects an invalid configured deployment link with a safe message", { concurrency: false }, async () => {
  global.fetch = async () => jsonResponse({ error: { message: "alias does not exist" } }, 404);

  await assert.rejects(
    () => assignTenantAlias("tenant.example"),
    (error) => {
      assert.equal(error.code, "VERCEL_SOURCE_DEPLOYMENT_NOT_FOUND");
      assert.equal(error.statusCode, 502);
      assert.equal(error.expose, true);
      assert.match(error.message, /Deployment link not reachable/i);
      assert.doesNotMatch(error.message, /alias does not exist/i);
      return true;
    },
  );
});

test("halts onboarding when the assigned tenant domain is not reachable", { concurrency: false }, async () => {
  let requestNumber = 0;
  global.fetch = async () => {
    requestNumber += 1;
    if (requestNumber === 1) return jsonResponse({ deployment: { id: "dpl_ready", url: "deploy.example" } });
    if (requestNumber === 2) return jsonResponse({ id: "dpl_ready", readyState: "READY", status: "READY" });
    if (requestNumber === 3) return new Response(null, { status: 200 });
    if (requestNumber === 4) return jsonResponse({ uid: "alias-1" });
    if (requestNumber === 5) return jsonResponse({ protectionBypass: { "*": { scope: "alias-protection-override" } } });
    return new Response(null, { status: 503 });
  };

  await assert.rejects(
    () => assignTenantAlias("tenant.example"),
    (error) => {
      assert.equal(error.code, "VERCEL_TENANT_DOMAIN_UNREACHABLE");
      assert.match(error.message, /Domain unavailable/i);
      return true;
    },
  );
});
