import "dotenv/config";
import crypto from "node:crypto";
import dns from "node:dns";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = require("../config/db");
const { controlModels } = require("../control/models");
const { runWithTenant } = require("../tenant/context");
const User = require("../models/User");
const Hospital = require("../models/Hospital");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Location = require("../models/Location");
const Speciality = require("../models/Speciality");
const Availability = require("../models/Availability");
const Counter = require("../models/Counter");

const demoPassword = process.env.DEMO_SEED_PASSWORD || "HospitaliaDemo!2026";
if (demoPassword.length < 12) throw new Error("DEMO_SEED_PASSWORD must contain at least 12 characters");
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Demo seed is disabled in production unless ALLOW_DEMO_SEED=true");
}

const planId = "10000000-0000-4000-8000-000000000001";
const platformAdminId = "10000000-0000-4000-8000-000000000002";
const demos = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    subscriptionId: "30000000-0000-4000-8000-000000000001",
    domainId: "40000000-0000-4000-8000-000000000001",
    invoiceId: "50000000-0000-4000-8000-000000000001",
    paymentId: "60000000-0000-4000-8000-000000000001",
    slug: "demo-alpha",
    legalName: "Alpha Care Hospital Limited",
    displayName: "Alpha Care Hospital",
    domain: process.env.DEMO_TENANT_ALPHA_DOMAIN || "hospitalia-demo-alpha.vercel.app",
    databaseAlias: "hospitalia_demo_alpha",
    adminPhone: "1700000001",
    hospitalPhone: "1700000002",
    doctorPhone: "1700000003",
    patientPhone: "1700000004",
    doctor: { firstName: "Ayesha", lastName: "Rahman", speciality: "Cardiology" },
    city: "Dhaka",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    subscriptionId: "30000000-0000-4000-8000-000000000002",
    domainId: "40000000-0000-4000-8000-000000000002",
    invoiceId: "50000000-0000-4000-8000-000000000002",
    paymentId: "60000000-0000-4000-8000-000000000002",
    slug: "demo-beta",
    legalName: "Beta Health Clinic Limited",
    displayName: "Beta Health Clinic",
    domain: process.env.DEMO_TENANT_BETA_DOMAIN || "hospitalia-demo-beta.vercel.app",
    databaseAlias: "hospitalia_demo_beta",
    adminPhone: "1800000001",
    hospitalPhone: "1800000002",
    doctorPhone: "1800000003",
    patientPhone: "1800000004",
    doctor: { firstName: "Nafis", lastName: "Hossain", speciality: "Neurology" },
    city: "Chattogram",
  },
];

async function seedOperationalTenant(demo, passwordHash) {
  if (!/^hospitalia_demo_(alpha|beta)$/.test(demo.databaseAlias)) throw new Error("Unsafe demo database alias");
  const database = mongoose.connection.useDb(demo.databaseAlias, { useCache: true });
  await database.dropDatabase();

  await runWithTenant({ tenantId: demo.id, tenantSlug: demo.slug, databaseName: demo.databaseAlias }, async () => {
    await Promise.all([User.init(), Hospital.init(), Doctor.init(), Patient.init(), Location.init(), Speciality.init(), Availability.init(), Counter.init()]);
    await Speciality.create({ id: 1, name: demo.doctor.speciality, description: `${demo.doctor.speciality} demo speciality`, status: "ACTIVE" });
    await User.insertMany([
      {
        id: 1,
        firstName: `${demo.displayName} Admin`,
        lastName: "",
        email: `admin@${demo.slug}.example.com`,
        countryCode: "+880",
        mobileNumber: demo.adminPhone,
        passwordHash,
        userType: "ADMIN",
        status: "ACTIVE",
        roles: [{ roleName: "TENANT_ADMIN", roleType: "SUPER_ADMIN" }],
      },
      {
        id: 2,
        firstName: demo.displayName,
        lastName: "",
        email: `hospital@${demo.slug}.example.com`,
        countryCode: "+880",
        mobileNumber: demo.hospitalPhone,
        passwordHash,
        userType: "HOSPITAL",
        status: "ACTIVE",
        roles: [{ roleName: "HOSPITAL", roleType: "HOSPITAL" }],
      },
      {
        id: 3,
        firstName: demo.doctor.firstName,
        lastName: demo.doctor.lastName,
        email: `doctor@${demo.slug}.example.com`,
        countryCode: "+880",
        mobileNumber: demo.doctorPhone,
        passwordHash,
        userType: "DOCTOR",
        status: "ACTIVE",
        roles: [{ roleName: "DOCTOR", roleType: "DOCTOR" }],
      },
      {
        id: 4,
        firstName: "Demo",
        lastName: "Patient",
        email: `patient@${demo.slug}.example.com`,
        countryCode: "+880",
        mobileNumber: demo.patientPhone,
        passwordHash,
        userType: "PATIENT",
        status: "ACTIVE",
        roles: [{ roleName: "PATIENT", roleType: "PATIENT" }],
      },
    ]);
    await Hospital.create({
      id: 1,
      userId: 2,
      hospitalName: demo.displayName,
      hospitalType: "GENERAL",
      workPhoneNumber: `+880${demo.hospitalPhone}`,
      email: `hospital@${demo.slug}.example.com`,
      countryCode: "+880",
      mobileNumber: demo.hospitalPhone,
      professionalInfoResponse: {
        professionalStatement: `${demo.displayName} is isolated SaaS demonstration data.`,
        departments: [{ id: 1, name: demo.doctor.speciality }],
        specialities: [{ id: 1, name: demo.doctor.speciality }],
      },
    });
    await Doctor.create({
      id: 1,
      userId: 3,
      status: "ACTIVE",
      firstName: demo.doctor.firstName,
      lastName: demo.doctor.lastName,
      gender: "OTHER",
      email: `doctor@${demo.slug}.example.com`,
      phoneNumber: `+880${demo.doctorPhone}`,
      verified: true,
      yearsOfExperience: 10,
      qualification: "MBBS, FCPS",
      professionalInfoResponse: {
        designation: `Consultant ${demo.doctor.speciality}`,
        professionalStatement: `Demo doctor available only in ${demo.displayName}.`,
        specialities: [{ id: 1, name: demo.doctor.speciality, description: "Demo speciality" }],
        departments: [{ id: 1, name: demo.doctor.speciality, hospitalUserId: 2 }],
      },
    });
    await Patient.create({
      id: 1,
      userId: 4,
      firstName: "Demo",
      lastName: "Patient",
      gender: "OTHER",
      email: `patient@${demo.slug}.example.com`,
      countryCode: "+880",
      mobileNumber: demo.patientPhone,
      dateOfBirth: "1990-01-01",
    });
    await Location.insertMany([
      {
        id: 1,
        locationId: 1,
        doctorId: 1,
        doctorUserId: 3,
        locationName: `${demo.displayName} ${demo.city} Chamber`,
        address: `Demo Road, ${demo.city}`,
        city: demo.city,
        country: "Bangladesh",
        newPatientFee: 1000,
        oldPatientFee: 700,
        feeCurrency: "BDT",
        active: true,
      },
      {
        id: 2,
        locationId: 2,
        hospitalId: 1,
        hospitalUserId: 2,
        locationName: `${demo.displayName} Main Branch`,
        address: `Demo Avenue, ${demo.city}`,
        city: demo.city,
        country: "Bangladesh",
        active: true,
      },
    ]);
    await Availability.insertMany(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"].map((dayOfWeek, index) => ({
      id: index + 1,
      doctorId: 1,
      doctorLocationId: 1,
      dayOfWeek,
      startTime: "09:00",
      endTime: "13:00",
      slotDuration: 30,
      active: true,
    })));
    await Counter.insertMany([
      { name: "users", seq: 4 },
      { name: "hospitals", seq: 1 },
      { name: "doctors", seq: 1 },
      { name: "patients", seq: 1 },
      { name: "locations", seq: 2 },
      { name: "specialities", seq: 1 },
      { name: "availabilities", seq: 5 },
    ]);
  });
}

async function main() {
  await connectDB();
  const { PlatformUser, Tenant, TenantDomain, Plan, Subscription, Invoice, Payment, AuditEvent } = await controlModels();
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  await PlatformUser.findOneAndUpdate(
    { id: platformAdminId },
    {
      id: platformAdminId,
      name: "Hospitalia Demo Super Admin",
      email: "superadmin@hospitalia.demo",
      passwordHash,
      role: "PLATFORM_SUPER_ADMIN",
      status: "ACTIVE",
      tokenVersion: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Plan.findOneAndUpdate(
    { id: planId },
    {
      id: planId,
      code: "DEMO_LAUNCH",
      name: "Hospitalia Demo Launch",
      billingInterval: "MONTHLY",
      amountMinor: 250000,
      currency: "BDT",
      setupFeeMinor: 1000000,
      trialDays: 0,
      gracePeriodDays: 7,
      entitlements: { appointments: true, reports: true, messaging: true },
      limits: { doctors: 20, staff: 50, locations: 5, monthlyAppointments: 5000 },
      active: true,
      version: 1,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  for (const demo of demos) {
    await Tenant.findOneAndUpdate(
      { id: demo.id },
      {
        id: demo.id,
        slug: demo.slug,
        legalName: demo.legalName,
        displayName: demo.displayName,
        status: "ACTIVE",
        databaseAlias: demo.databaseAlias,
        defaultLocale: "en",
        timezone: "Asia/Dhaka",
        currency: "BDT",
        primaryDomain: demo.domain,
        onboardingStatus: "COMPLETED",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await TenantDomain.deleteMany({ tenantId: demo.id });
    await TenantDomain.create({
      id: demo.domainId,
      tenantId: demo.id,
      hostname: demo.domain,
      type: "PLATFORM_SUBDOMAIN",
      status: "ACTIVE",
      verifiedAt: new Date(),
    });
    await Subscription.deleteMany({ tenantId: demo.id });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
    await Subscription.create({
      id: demo.subscriptionId,
      tenantId: demo.id,
      activeKey: demo.id,
      planId,
      planVersion: 1,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      priceSnapshot: {
        amountMinor: 250000,
        currency: "BDT",
        setupFeeMinor: 1000000,
        billingInterval: "MONTHLY",
        gracePeriodDays: 7,
        planCode: "DEMO_LAUNCH",
        planName: "Hospitalia Demo Launch",
        planVersion: 1,
      },
      entitlementSnapshot: {
        entitlements: { appointments: true, reports: true, messaging: true },
        limits: { doctors: 20, staff: 50, locations: 5, monthlyAppointments: 5000 },
      },
      version: 1,
    });
    await Payment.deleteMany({ tenantId: demo.id });
    await Invoice.deleteMany({ tenantId: demo.id });
    await Invoice.create({
      id: demo.invoiceId,
      tenantId: demo.id,
      subscriptionId: demo.subscriptionId,
      invoiceNumber: `DEMO-${demo.slug.toUpperCase()}-001`,
      status: "PAID",
      lineItems: [{ description: "Hospitalia Demo Launch subscription", quantity: 1, unitAmountMinor: 250000, totalMinor: 250000 }],
      subtotalMinor: 250000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 250000,
      currency: "BDT",
      issuedAt: now,
      dueAt: now,
      paidAt: now,
    });
    await Payment.create({
      id: demo.paymentId,
      tenantId: demo.id,
      invoiceId: demo.invoiceId,
      method: "BKASH",
      providerReference: `DEMO-${demo.slug.toUpperCase()}-PAYMENT`,
      amountMinor: 250000,
      currency: "BDT",
      status: "VERIFIED",
      idempotencyKey: `demo-${demo.slug}-payment-001`,
      receivedAt: now,
      verifiedAt: now,
      verifiedBy: platformAdminId,
    });
    await seedOperationalTenant(demo, passwordHash);
    await AuditEvent.create({
      id: crypto.randomUUID(),
      tenantId: demo.id,
      actorType: "SYSTEM",
      action: "DEMO_TENANT_PROVISIONED",
      targetType: "TENANT",
      targetId: demo.id,
      metadata: { domain: demo.domain, databaseAlias: demo.databaseAlias },
    });
  }

  console.log("Hospitalia SaaS demo seeded.");
  console.log(JSON.stringify({
    platform: { email: "superadmin@hospitalia.demo", password: demoPassword },
    tenants: demos.map((demo) => ({
      name: demo.displayName,
      domain: demo.domain,
      tenantAdmin: { countryCode: "+880", phone: demo.adminPhone, password: demoPassword },
      doctor: { countryCode: "+880", phone: demo.doctorPhone, password: demoPassword },
      patient: { countryCode: "+880", phone: demo.patientPhone, password: demoPassword },
    })),
  }, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

