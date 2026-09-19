const baseUrl = (process.argv[2] || "http://localhost:5001").replace(/\/$/, "");
const timeoutMs = 20_000;

const specResponse = await fetch(`${baseUrl}/api-docs.json`, {
  signal: AbortSignal.timeout(timeoutMs),
});
if (!specResponse.ok) {
  throw new Error(`OpenAPI document returned ${specResponse.status}`);
}

const spec = await specResponse.json();
const operations = [];
for (const [path, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    operations.push({ method: method.toUpperCase(), path, operation });
  }
}

function concretePath(path) {
  return path
    .replaceAll("{id}", "999999")
    .replaceAll("{userId}", "999999")
    .replaceAll("{doctorId}", "999999")
    .replaceAll("{doctorUserId}", "999999")
    .replaceAll("{patientUserId}", "999999")
    .replaceAll("{secretaryUserId}", "999999")
    .replaceAll("{hospitalId}", "999999")
    .replaceAll("{hospitalUserId}", "999999")
    .replaceAll("{locationId}", "999999")
    .replaceAll("{doctorLocationId}", "999999")
    .replaceAll("{appointmentId}", "999999")
    .replaceAll("{threadId}", "999999");
}

async function check({ method, path, operation }) {
  const protectedOperation = Array.isArray(operation.security) && operation.security.length > 0;
  const url = new URL(concretePath(path), baseUrl);
  if (path.includes("available-slots") || path.includes("/date/doctorLocationId/")) {
    url.searchParams.set("date", "2099-01-01");
  }
  if (path.includes("invitation/info")) url.searchParams.set("token", "invalid-smoke-token");
  if (path.includes("global-search/search")) url.searchParams.set("q", "smoke-test-no-match");

  const init = {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) init.body = "{}";

  try {
    const response = await fetch(url, init);
    const text = await response.text();
    const routeMissing = /Route not found:/i.test(text);
    const ok = protectedOperation
      ? response.status === 401
      : response.status < 500 && !routeMissing;
    return { method, path, status: response.status, protectedOperation, ok, routeMissing };
  } catch (error) {
    return { method, path, status: 0, protectedOperation, ok: false, error: String(error) };
  }
}

const results = [];
for (let index = 0; index < operations.length; index += 6) {
  results.push(...(await Promise.all(operations.slice(index, index + 6).map(check))));
}

const failures = results.filter((result) => !result.ok);
console.log(`API smoke: ${results.length - failures.length}/${results.length} passed against ${baseUrl}`);
for (const failure of failures) console.error(JSON.stringify(failure));
if (failures.length) process.exitCode = 1;
