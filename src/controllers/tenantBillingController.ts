const { controlModels } = require("../control/models");
const { success, error } = require("../utils/apiResponse");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const Location = require("../models/Location");
const Appointment = require("../models/Appointment");

async function summary(req, res) {
  if (!req.tenant?.tenantId) return error(res, "Tenant billing is unavailable for the legacy workspace", 404);
  const { Tenant, Plan, Subscription, Invoice } = await controlModels();
  const [tenant, subscription, invoices, usage] = await Promise.all([
    Tenant.findOne({ id: req.tenant.tenantId }).lean(),
    Subscription.findOne({ tenantId: req.tenant.tenantId, activeKey: req.tenant.tenantId }).lean(),
    Invoice.find({ tenantId: req.tenant.tenantId }).sort({ createdAt: -1 }).limit(20).lean(),
    Promise.all([
      Doctor.countDocuments({ status: { $ne: "SUSPENDED" } }),
      User.countDocuments({ userType: { $in: ["ADMIN", "SECRETARY"] }, status: "ACTIVE" }),
      Location.countDocuments({ active: true }),
      Appointment.countDocuments({ createdAt: { $gte: new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) } }),
    ]),
  ]);
  if (!tenant || !subscription) return error(res, "Tenant subscription not found", 404);
  const plan = await Plan.findOne({ id: subscription.planId }).lean();
  const [doctors, staff, locations, monthlyAppointments] = usage;
  return success(res, {
    tenant: { id: tenant.id, slug: tenant.slug, displayName: tenant.displayName, primaryDomain: tenant.primaryDomain },
    subscription: {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      graceEndsAt: subscription.graceEndsAt,
      plan: plan ? { id: plan.id, code: plan.code, name: plan.name, billingInterval: plan.billingInterval } : null,
      price: subscription.priceSnapshot,
      entitlements: subscription.entitlementSnapshot,
    },
    usage: { doctors, staff, locations, monthlyAppointments },
    invoices,
  }, "Tenant billing summary fetched");
}

module.exports = { summary };
