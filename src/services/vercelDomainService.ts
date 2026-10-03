const env = require("../config/env");

const DOMAIN_PROVISIONING_MESSAGE = "Domain provisioning failed. Customer setup was saved and can be retried safely.";
const DEPLOYMENT_UNAVAILABLE_MESSAGE = "Deployment link not reachable. Check the Vercel deployment and retry.";
const DOMAIN_UNAVAILABLE_MESSAGE = "Domain unavailable. The tenant domain could not be reached, so onboarding was not completed.";

function provisioningError(cause, {
  statusCode = 502,
  code = "VERCEL_DOMAIN_PROVISIONING_FAILED",
  context = {},
  publicMessage = DOMAIN_PROVISIONING_MESSAGE,
} = {}) {
  return Object.assign(new Error(publicMessage, { cause }), {
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

async function verifyReachable(hostname, { publicMessage, code, action }) {
  let lastFailure;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      let response = await fetch(`https://${hostname}`, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": "Hospitalia-Domain-Provisioner/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 405) {
        response = await fetch(`https://${hostname}`, {
          method: "GET",
          redirect: "manual",
          headers: { "User-Agent": "Hospitalia-Domain-Provisioner/1.0" },
          signal: AbortSignal.timeout(8_000),
        });
      }
      const location = response.headers.get("location");
      const redirectsWithinDomain = response.status < 300
        || (location && new URL(location, `https://${hostname}`).hostname === hostname);
      if (response.status >= 200 && response.status < 400 && redirectsWithinDomain) {
        if (response.body) await response.body.cancel();
        return { reachable: true, status: response.status };
      }
      lastFailure = new Error(
        location && !redirectsWithinDomain
          ? `Reachability probe redirected outside the domain to ${new URL(location, `https://${hostname}`).hostname}`
          : `Reachability probe returned HTTP ${response.status}`,
      );
    } catch (err) {
      lastFailure = err;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw provisioningError(lastFailure || new Error("Reachability probe failed"), {
    code,
    publicMessage,
    context: { action, hostname },
  });
}

async function resolveReadyDeployment(configuredDeployment, hostname) {
  const sourceLookup = await fetch(
    `https://api.vercel.com/v4/aliases/${encodeURIComponent(configuredDeployment)}${teamQuery()}`,
    { headers: { Authorization: `Bearer ${env.vercelApiToken}` }, signal: AbortSignal.timeout(15_000) },
  );
  const source = await readJson(sourceLookup);
  const deploymentId = source?.deployment?.id || source?.deploymentId;
  const deployment = source?.deployment?.url;
  if (!sourceLookup.ok || !deploymentId || !deployment) {
    const message = source?.error?.message || source?.message || "Configured Vercel deployment alias was not found";
    throw provisioningError(new Error(message), {
      code: "VERCEL_SOURCE_DEPLOYMENT_NOT_FOUND",
      publicMessage: DEPLOYMENT_UNAVAILABLE_MESSAGE,
      context: { action: "source-lookup", hostname, configuredDeployment, vercelStatus: sourceLookup.status },
    });
  }

  const statusResponse = await fetch(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${teamQuery()}`,
    { headers: { Authorization: `Bearer ${env.vercelApiToken}` }, signal: AbortSignal.timeout(15_000) },
  );
  const status = await readJson(statusResponse);
  if (!statusResponse.ok || status?.readyState !== "READY" || status?.status !== "READY") {
    const message = status?.error?.message || status?.message || `Deployment state is ${status?.readyState || status?.status || "unknown"}`;
    throw provisioningError(new Error(message), {
      code: "VERCEL_SOURCE_DEPLOYMENT_NOT_READY",
      publicMessage: DEPLOYMENT_UNAVAILABLE_MESSAGE,
      context: {
        action: "deployment-status",
        hostname,
        configuredDeployment,
        deploymentId,
        readyState: status?.readyState,
        deploymentStatus: status?.status,
        vercelStatus: statusResponse.status,
      },
    });
  }

  const reachability = await verifyReachable(configuredDeployment, {
    publicMessage: DEPLOYMENT_UNAVAILABLE_MESSAGE,
    code: "VERCEL_SOURCE_DEPLOYMENT_UNREACHABLE",
    action: "source-reachability",
  });
  return { deployment, deploymentId, sourceReachabilityStatus: reachability.status };
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
      publicMessage: DOMAIN_UNAVAILABLE_MESSAGE,
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
    const { deployment, deploymentId, sourceReachabilityStatus } = await resolveReadyDeployment(configuredDeployment, hostname);
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
          publicMessage: "Domain unavailable. This domain is already assigned to another deployment.",
          context: { action: "assign-alias", hostname, deployment, vercelStatus: response.status },
        });
      }
      await ensurePublicAlias(hostname);
      const reachability = await verifyReachable(hostname, {
        publicMessage: DOMAIN_UNAVAILABLE_MESSAGE,
        code: "VERCEL_TENANT_DOMAIN_UNREACHABLE",
        action: "tenant-domain-reachability",
      });
      return {
        hostname,
        deployment,
        deploymentId,
        aliasId: current.uid || null,
        alreadyAssigned: true,
        publicAccess: true,
        sourceReachabilityStatus,
        reachabilityStatus: reachability.status,
      };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || "Vercel could not assign the tenant domain";
      throw provisioningError(new Error(message), {
        code: "VERCEL_ALIAS_ASSIGNMENT_FAILED",
        publicMessage: DOMAIN_UNAVAILABLE_MESSAGE,
        context: { action: "assign-alias", hostname, deployment, vercelStatus: response.status },
      });
    }
    await ensurePublicAlias(hostname);
    const reachability = await verifyReachable(hostname, {
      publicMessage: DOMAIN_UNAVAILABLE_MESSAGE,
      code: "VERCEL_TENANT_DOMAIN_UNREACHABLE",
      action: "tenant-domain-reachability",
    });
    return {
      hostname,
      deployment,
      deploymentId,
      aliasId: data.uid || null,
      alreadyAssigned: false,
      publicAccess: true,
      sourceReachabilityStatus,
      reachabilityStatus: reachability.status,
    };
  } catch (err) {
    if (err?.expose) throw err;
    throw provisioningError(err, {
      context: { action: "vercel-request", hostname, timeout: err?.name === "TimeoutError" },
    });
  }
}

module.exports = { assignTenantAlias };
