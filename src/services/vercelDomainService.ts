const env = require("../config/env");

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

async function assignTenantAlias(hostname) {
  if (!env.vercelApiToken || !env.vercelFrontendDeployment) {
    throw Object.assign(new Error("Vercel domain automation is not configured"), { statusCode: 503 });
  }

  const deployment = env.vercelFrontendDeployment
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
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
      throw Object.assign(new Error(message), { statusCode: 409 });
    }
    return { hostname, deployment, aliasId: current.uid || null, alreadyAssigned: true };
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || "Vercel could not assign the tenant domain";
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
  return { hostname, deployment, aliasId: data.uid || null, alreadyAssigned: false };
}

module.exports = { assignTenantAlias };
