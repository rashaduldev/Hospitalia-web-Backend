const crypto = require("crypto");
const { controlModels } = require("./models");

async function writeAudit(req, event) {
  const { AuditEvent } = await controlModels();
  await AuditEvent.create({
    id: crypto.randomUUID(),
    actorType: req.platformUser ? "PLATFORM_USER" : "SYSTEM",
    actorId: req.platformUser?.id,
    requestId: req.id,
    ...event,
  });
}

module.exports = { writeAudit };
