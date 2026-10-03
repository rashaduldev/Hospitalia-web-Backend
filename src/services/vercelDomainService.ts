const env = require("../config/env");

const DOMAIN_PROVISIONING_MESSAGE = "Domain provisioning failed. Customer setup was saved and can be retried safely.";

function provisioningError(cause, { statusCode = 502, code = "VERCEL_DOMAIN_PROVISIONING_FAILED", context = {} } = {}) {
  return Object.assign(new Error(DOMAIN_PROVISIONING_MESSAGE, { cause }), {
    statusCode,
    code,
    expose: true,
    context,
  });
}

function teamQuery() {
  return env.vercelTeamId ? `?teamId=${encodeURIComponent(env.vercelTeamId)}` : "";
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function ensurePublicAlias(hostname) {
  const lookup = await fetch(
    `https://api.vercel.com/v4/aliases/${encodeURIComponent(hostname)}${teamQuery()}`,
    { headers: { Authorization: `Bearer ${env.vercelApiToken}` }, signal: AbortSignal.timeout(15_000) },
  );
  if (lookup.ok) {
    const current = await readJson(lookup);
    if (current?.protectionBypass) return true;
  }
  const response = await fetch(
    `https://api.vercel.com/aliases/${encodeURIComponent(hostname)}/protection-bypass${teamQuery()}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.vercelApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ override: { scope: "alias-protection-override", action: "create" } }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const data = await readJson(response);
  if (!response.ok && response.status !== 409) {
    const message = data?.error?.message || data?.message || "Vercel could not make the tenant domain public";
    throw provisioningError(new Error(message), {
      code: "VERCEL_ALIAS_PUBLIC_ACCESS_FAILED",
      context: { action: "protection-bypass", hostname, vercelStatus: response.status },
    });
  }
  return true;
}

async function assignTenantAlias(hostname) {
  if (!env.vercelApiToken || !env.vercelFrontendDeployment) {
    throw provisioningError(new Error("Vercel domain automation is not configured"), {
      statusCode: 503,
      code: "VERCEL_DOMAIN_AUTOMATION_NOT_CONFIGURED",
      context: { action: "configuration", hostname },
    });
  }

  try {
    const configuredDeployment = env.vercelFrontendDeployment
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    let deployment = configuredDeployment;
    const sourceLookup = await fetch(
      `https://api.vercel.com/v4/aliases/${encodeURIComponent(configuredDeployment)}${teamQuery()}`,
      { headers: { Authorization: `Bearer ${env.vercelApiToken}` }, signal: AbortSignal.timeout(15_000) },
    );
    if (sourceLookup.ok) {
      const source = await readJson(sourceLookup);
      deployment = source?.deployment?.url || configuredDeployment;
    }
    const response = await fetch(
      `https://api.vercel.com/v2/deployments/${encodeURIComponent(deployment)}/aliases${teamQuery()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.vercelApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alias: hostname }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readJson(response);
    if (response.status === 409) {
      const lookup = await fetch(
        `https://api.vercel.com/v4/aliases/${encodeURIComponent(hostname)}${teamQuery()}`,
        { headers: { Authorization: `Bearer ${env.vercelApiToken}` }, signal: AbortSignal.timeout(15_000) },
      );
      const current = await readJson(lookup);
      if (!lookup.ok || current?.deployment?.url !== deployment) {
        const message = data?.error?.message || data?.message || "The tenant domain is assigned to another deployment";
        throw provisioningError(new Error(message), {
          statusCode: 409,
          code: "VERCEL_ALIAS_CONFLICT",
          context: { action: "assign-alias", hostname, deployment, vercelStatus: response.status },
        });
      }
      await ensurePublicAlias(hostname);
      return { hostname, deployment, aliasId: current.uid || null, alreadyAssigned: true, publicAccess: true };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || "Vercel could not assign the tenant domain";
      throw provisioningError(new Error(message), {
        code: "VERCEL_ALIAS_ASSIGNMENT_FAILED",
        context: { action: "assign-alias", hostname, deployment, vercelStatus: response.status },
      });
    }
    await ensurePublicAlias(hostname);
    return { hostname, deployment, aliasId: data.uid || null, alreadyAssigned: false, publicAccess: true };
  } catch (err) {
    if (err?.expose) throw err;
    throw provisioningError(err, {
      context: { action: "vercel-request", hostname, timeout: err?.name === "TimeoutError" },
    });
  }
}

module.exports = { assignTenantAlias };
