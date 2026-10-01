const crypto = require("node:crypto");
const { controlModels } = require("../control/models");

function defaultWebsiteConfig(tenant) {
  const name = tenant.displayName || tenant.legalName || "Your Hospital";
  return {
    template: "MODERN",
    branding: {
      logoUrl: "",
      primaryColor: "#0F766E",
      secondaryColor: "#14B8A6",
      accentColor: "#F59E0B",
    },
    seo: {
      title: `${name} | Trusted healthcare`,
      description: `Find experienced doctors and book appointments with ${name}.`,
    },
    sectionOrder: ["hero", "services", "about", "stats", "cta"],
    sections: {
      hero: {
        enabled: true,
        eyebrow: "Care you can trust",
        title: `Better healthcare starts at ${name}`,
        description: "Search experienced specialists, review availability and book the care you need.",
        primaryCtaLabel: "Find a doctor",
        primaryCtaHref: "/search",
        secondaryCtaLabel: "Patient login",
        secondaryCtaHref: "/patient/login",
      },
      services: {
        enabled: true,
        title: "Healthcare made simpler",
        description: "Everything patients need to discover and coordinate quality care.",
        items: [
          { title: "Verified doctors", description: "Discover qualified specialists with clear profiles." },
          { title: "Easy appointments", description: "Choose a convenient schedule and book in minutes." },
          { title: "Connected care", description: "Keep appointments and care information organized." },
        ],
      },
      about: {
        enabled: true,
        eyebrow: "About us",
        title: `Patient-first care from ${name}`,
        description: "Our team combines trusted clinical expertise with a convenient digital experience for every patient.",
      },
      stats: {
        enabled: true,
        items: [
          { value: "24/7", label: "Online access" },
          { value: "100%", label: "Secure platform" },
          { value: "1 place", label: "For every appointment" },
        ],
      },
      cta: {
        enabled: true,
        title: "Ready to book your next appointment?",
        description: "Find the right healthcare professional and choose a schedule that works for you.",
        buttonLabel: "Book an appointment",
        buttonHref: "/search",
      },
    },
  };
}

async function ensureTenantWebsite(tenant) {
  const { TenantWebsite } = await controlModels();
  const existing = await TenantWebsite.findOne({ tenantId: tenant.id });
  if (existing) return existing;
  const config = defaultWebsiteConfig(tenant);
  try {
    return await TenantWebsite.create({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      draft: config,
      published: config,
      status: "PUBLISHED",
      version: 1,
      publishedAt: new Date(),
      publishedBy: "SYSTEM",
    });
  } catch (error) {
    if (error?.code === 11000) return TenantWebsite.findOne({ tenantId: tenant.id });
    throw error;
  }
}

module.exports = { defaultWebsiteConfig, ensureTenantWebsite };
