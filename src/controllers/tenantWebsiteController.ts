const { z } = require("zod");
const { controlModels } = require("../control/models");
const { ensureTenantWebsite } = require("../services/tenantWebsiteService");
const { success, error } = require("../utils/apiResponse");

const shortText = z.string().trim().min(1).max(120);
const longText = z.string().trim().min(1).max(600);
const safeHref = z.string().trim().max(300).refine((value) => value.startsWith("/") || /^https:\/\//i.test(value), "Use a relative path or HTTPS URL");
const logoUrl = z.string().trim().max(500).refine((value) => !value || value.startsWith("/") || /^https:\/\//i.test(value), "Use a relative path or HTTPS URL");
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex color");
const sectionBase = { enabled: z.boolean() };
const websiteConfigInput = z.object({
  template: z.enum(["MODERN", "CLASSIC", "MINIMAL"]),
  branding: z.object({ logoUrl, primaryColor: color, secondaryColor: color, accentColor: color }),
  seo: z.object({ title: shortText.max(70), description: longText.max(160) }),
  sectionOrder: z.array(z.enum(["hero", "services", "about", "stats", "cta"])).length(5).refine((items) => new Set(items).size === 5, "Section order must not contain duplicates"),
  sections: z.object({
    hero: z.object({ ...sectionBase, eyebrow: shortText, title: shortText, description: longText, primaryCtaLabel: shortText, primaryCtaHref: safeHref, secondaryCtaLabel: shortText, secondaryCtaHref: safeHref }),
    services: z.object({ ...sectionBase, title: shortText, description: longText, items: z.array(z.object({ title: shortText, description: longText })).min(1).max(6) }),
    about: z.object({ ...sectionBase, eyebrow: shortText, title: shortText, description: longText }),
    stats: z.object({ ...sectionBase, items: z.array(z.object({ value: shortText, label: shortText })).min(1).max(4) }),
    cta: z.object({ ...sectionBase, title: shortText, description: longText, buttonLabel: shortText, buttonHref: safeHref }),
  }),
}).strict();

async function currentTenant(req, res) {
  if (!req.tenant?.tenantId) {
    error(res, "Website customization is unavailable for the legacy workspace", 404);
    return null;
  }
  const { Tenant } = await controlModels();
  const tenant = await Tenant.findOne({ id: req.tenant.tenantId, status: "ACTIVE" }).lean();
  if (!tenant) {
    error(res, "Tenant not found", 404);
    return null;
  }
  return tenant;
}

async function getPublicWebsite(req, res) {
  if (!req.tenant?.tenantId) {
    res.set("Cache-Control", "private, no-store, max-age=0");
    return success(res, null, "No tenant website is configured for this host");
  }
  const tenant = await currentTenant(req, res);
  if (!tenant) return;
  const website = await ensureTenantWebsite(tenant);
  res.set("Cache-Control", "private, no-store, max-age=0");
  return success(res, { tenant: { displayName: tenant.displayName, primaryDomain: tenant.primaryDomain }, config: website.published, version: website.version, publishedAt: website.publishedAt }, "Published website fetched");
}

async function getWebsiteEditor(req, res) {
  const tenant = await currentTenant(req, res);
  if (!tenant) return;
  const website = await ensureTenantWebsite(tenant);
  return success(res, { tenant: { displayName: tenant.displayName, primaryDomain: tenant.primaryDomain }, draft: website.draft, published: website.published, status: website.status, version: website.version, publishedAt: website.publishedAt }, "Website editor fetched");
}

async function saveDraft(req, res) {
  const parsed = websiteConfigInput.safeParse(req.body);
  if (!parsed.success) return error(res, parsed.error.issues[0]?.message || "Invalid website configuration", 422);
  const tenant = await currentTenant(req, res);
  if (!tenant) return;
  const { TenantWebsite, AuditEvent } = await controlModels();
  await ensureTenantWebsite(tenant);
  const website = await TenantWebsite.findOneAndUpdate({ tenantId: tenant.id }, { $set: { draft: parsed.data, status: "DRAFT" } }, { new: true });
  await AuditEvent.create({ id: require("node:crypto").randomUUID(), tenantId: tenant.id, actorType: "TENANT_USER", actorId: String(req.user.id), action: "TENANT_WEBSITE_DRAFT_SAVED", targetType: "TENANT_WEBSITE", targetId: website.id, requestId: req.id, metadata: { template: parsed.data.template, version: website.version } });
  return success(res, { draft: website.draft, status: website.status, version: website.version }, "Website draft saved");
}

async function publishWebsite(req, res) {
  const tenant = await currentTenant(req, res);
  if (!tenant) return;
  const { TenantWebsite, AuditEvent } = await controlModels();
  const website = await ensureTenantWebsite(tenant);
  const parsed = websiteConfigInput.safeParse(website.draft);
  if (!parsed.success) return error(res, "The saved draft is no longer valid", 422);
  website.published = parsed.data;
  website.status = "PUBLISHED";
  website.version += 1;
  website.publishedAt = new Date();
  website.publishedBy = String(req.user.id);
  await website.save();
  await AuditEvent.create({ id: require("node:crypto").randomUUID(), tenantId: tenant.id, actorType: "TENANT_USER", actorId: String(req.user.id), action: "TENANT_WEBSITE_PUBLISHED", targetType: "TENANT_WEBSITE", targetId: website.id, requestId: req.id, metadata: { template: parsed.data.template, version: website.version } });
  return success(res, { published: website.published, status: website.status, version: website.version, publishedAt: website.publishedAt }, "Website published");
}

module.exports = { getPublicWebsite, getWebsiteEditor, saveDraft, publishWebsite };
