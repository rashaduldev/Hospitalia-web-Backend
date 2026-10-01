# Hospitalia SaaS Conversion Master Plan

## 1. Product decision

Hospitalia will be sold as a managed, tenant-isolated B2B SaaS to hospitals and clinics.
The first two customers must use the same application releases, while their users,
appointments, doctors, patients, files, audit events, configuration and backups remain
isolated.

The recommended first commercial release is **manual billing with automated access
control**. Hospitalia creates invoices and records bKash/bank/other payments; a platform
operator verifies payment. A payment-provider adapter can be added after the first two
customers are stable. This prevents payment integration from delaying launch while still
making subscription state enforceable in code.

## 2. Architecture decision

### Control plane

A dedicated control-plane MongoDB database stores only SaaS administration data:

- tenants and domains;
- plans, entitlements and limits;
- subscriptions and lifecycle history;
- invoices and payment records;
- platform administrators;
- tenant administrators and membership status;
- provisioning jobs and audit events;
- tenant database aliases, never plaintext database credentials.

### Data plane

Each tenant receives a separate MongoDB database for operational and healthcare data.
The existing Hospitalia collections live in that tenant database. Database-per-tenant is
the default because it gives the first customers a strong isolation boundary, independent
backup/restore and straightforward contract termination/export.

```text
Customer browser
  -> acme.hospitalia.app or customer's verified domain
  -> Next.js application
  -> Hospitalia API
       -> resolve and validate domain/tenant
       -> authenticate membership and subscription
       -> select tenant database connection
       -> execute the existing Hospitalia workflow

Platform operator
  -> admin.hospitalia.app
  -> Super Admin control plane
  -> tenants / plans / subscriptions / invoices / audit / provisioning
```

The production request must never accept a raw database name or connection string from
the browser. A verified host/domain resolves to a server-owned tenant record. A
super-admin may select a tenant only through an audited platform endpoint.

## 3. Repository boundary

| Repository | SaaS responsibility |
| --- | --- |
| `Hospitalia-web-Backend` | Control-plane APIs, tenant resolution, subscription enforcement and tenant data connections. |
| `hospitalia-web-frontend` | Tenant-aware public site and hospital/client workspaces. |
| `dashboard-v2/Uivibe-dashboard-frontend` | UI shell/design reference for the future Super Admin application. Replace its commerce routes and API contracts. |
| `dashboard-v2/Uivibe-Backend` | Do not use as the Hospitalia control plane. It is a separate Laravel commerce backend and would duplicate identity, authorization and billing state. |

The Super Admin frontend can be a separately deployed application, but there must be one
authoritative Hospitalia control-plane API.

## 4. Core schema

### Tenant

```text
Tenant
  id: UUID
  slug: unique immutable string
  legalName / displayName
  status: PROVISIONING | ACTIVE | SUSPENDED | OFFBOARDING | CLOSED
  databaseAlias: server-side secret lookup key
  defaultLocale / timezone / currency
  primaryDomain
  onboardingStatus
  ownerMembershipId
  createdAt / updatedAt
```

### Domain

```text
TenantDomain
  id, tenantId
  hostname: globally unique, normalized lowercase
  type: PLATFORM_SUBDOMAIN | CUSTOM
  status: PENDING | VERIFIED | ACTIVE | FAILED
  verificationTokenHash
  verifiedAt
```

### Identity and membership

```text
PlatformUser
  id, name, email, phone, passwordHash/status/tokenVersion

TenantMembership
  id, tenantId, platformUserId
  role: OWNER | TENANT_ADMIN | BILLING_ADMIN | STAFF
  status: INVITED | ACTIVE | SUSPENDED | REVOKED
  invitedBy / invitedAt / acceptedAt
```

Clinical users can remain in each tenant database during the first release. Platform and
tenant administrators use control-plane identities. This avoids accidentally making
patient/doctor PII global.

### Plans and entitlements

```text
Plan
  id, code, name, billingInterval
  amount, currency, setupFee
  trialDays, gracePeriodDays
  entitlements: map of feature -> enabled
  limits: doctors, staff, locations, monthlyAppointments, storageMb
  active, version

Subscription
  id, tenantId, planId, planVersion
  status: TRIALING | ACTIVE | PAST_DUE | SUSPENDED | CANCELLED | EXPIRED
  currentPeriodStart / currentPeriodEnd
  trialEnd / graceEndsAt / cancelAtPeriodEnd / cancelledAt
  priceSnapshot / entitlementSnapshot / version

Invoice
  id, tenantId, subscriptionId, invoiceNumber
  status: DRAFT | ISSUED | PAID | VOID | OVERDUE
  lineItems / subtotal / discount / tax / total / currency
  issuedAt / dueAt / paidAt

Payment
  id, tenantId, invoiceId
  method: BANK | BKASH | NAGAD | CASH | OTHER
  providerReference / amount / currency
  status: PENDING | VERIFIED | REJECTED | REFUNDED
  receivedAt / verifiedAt / verifiedBy
  idempotencyKey
```

Money values are stored in the smallest currency unit (poisha/cents), never floating
point. Plan and entitlement snapshots prevent later plan edits from rewriting historical
subscriptions.

### Audit and provisioning

```text
AuditEvent
  id, tenantId?, actorType, actorId
  action, targetType, targetId
  requestId, ipHash, userAgent, metadata
  createdAt (append-only)

ProvisioningJob
  id, tenantId
  status: QUEUED | RUNNING | SUCCEEDED | FAILED
  steps, attemptCount, lastError, idempotencyKey
```

## 5. Tenant and subscription request rules

1. Normalize and validate `Host` against `TenantDomain`.
2. Reject unknown, unverified or disabled domains before application data access.
3. Resolve the control-plane tenant and subscription.
4. Authenticate the user and verify the token's tenant/membership claims.
5. Enforce membership status, role and token version.
6. Enforce subscription state and feature entitlement.
7. Open/reuse the connection identified by the server-side database alias.
8. Execute the operation and write an audit event for sensitive mutations.

Public discovery and booking routes are tenant-scoped by domain. `admin.hospitalia.app`
uses only the control plane. Health endpoints must not reveal tenant or database details.

### Subscription behavior

| State | Behavior |
| --- | --- |
| `TRIALING` / `ACTIVE` | Normal entitlement and quota enforcement. |
| `PAST_DUE` before grace end | Continue service, show persistent billing warning, block plan upgrades that increase unpaid balance. |
| `SUSPENDED` | Tenant admins can access billing/export/support only; operational writes and public booking are blocked. |
| `CANCELLED` / `EXPIRED` | Read-only export window according to contract, then scheduled offboarding. |

Super-admin override must require a reason, expiry time and audit entry. It must not silently
change paid history.

## 6. Provisioning workflow

1. Super Admin creates tenant and selects plan.
2. System reserves a unique slug and platform subdomain.
3. Provisioning job creates tenant database and indexes.
4. Reference data is seeded idempotently; demo patient data is never seeded.
5. Owner receives a single-use, expiring invitation.
6. Owner sets password and MFA/recovery information.
7. Subscription starts as trial or active based on the signed order.
8. Smoke test runs against the new tenant only.
9. Operator records onboarding completion and sends the handoff pack.

Every step is retryable and records its outcome. Creating the same tenant twice with the
same idempotency key must return the original provisioning job.

## 7. Implementation phases and release gates

### Phase 0 — commercial and operational decisions

- Decide product name, included modules, support hours and data-retention period.
- Define three plans at most; keep the first two customers on one launch plan if possible.
- Sign subscription agreement, privacy/data-processing terms and implementation order.
- Create a staging environment and restore-tested database backup before schema changes.

Gate: written scope, price, support boundary and customer data owner are agreed.

### Phase 1 — control-plane foundation

- Add control-plane configuration and database connection.
- Implement Tenant, Domain, PlatformUser, Membership, Plan, Subscription, Invoice,
  Payment, AuditEvent and ProvisioningJob models.
- Implement platform authentication and strict `PLATFORM_SUPER_ADMIN` authorization.
- Add tenant CRUD, plan CRUD, subscription lifecycle and manual payment verification APIs.
- Add validation, idempotency and audit logging.

Gate: unit/integration tests prove a tenant admin cannot call platform endpoints.

### Phase 2 — tenant data isolation

- Resolve tenant from verified host.
- Add bounded per-tenant Mongoose connection caching suitable for serverless execution.
- Load existing Hospitalia models against the selected tenant connection.
- Add an explicit migration that moves existing production data to a named legacy tenant.
- Remove direct use of the global data-plane connection from request controllers.
- Add cross-tenant denial tests for reads, writes, exports, search, booking and IDs.

Gate: a two-tenant test matrix demonstrates zero cross-tenant access, including guessed
IDs and forged headers/tokens.

### Phase 3 — subscription enforcement

- Add subscription/entitlement middleware after tenant/auth resolution.
- Add quota counters for doctors, staff, locations, appointments and storage.
- Implement invoice numbering and manual payment approval.
- Add grace-period warnings and restricted billing/export mode.
- Make lifecycle changes idempotent and append-only in audit history.

Gate: lifecycle tests cover trial, renewal, overdue, grace, suspension, reactivation and
cancellation with frozen time.

### Phase 4 — Super Admin and tenant admin UI

- Build `admin.hospitalia.app` from the useful layout pieces in dashboard-v2.
- Pages: overview, tenants, tenant detail, onboarding, plans, subscriptions, invoices,
  payments, audit log, provisioning jobs and support notes.
- Add tenant admin billing page, plan/limit visibility and staff invitations.
- Never place database secrets, JWT secrets or raw connection aliases in frontend data.

Gate: role and tenant navigation tests, accessible forms, mobile checks and production
builds pass.

### Phase 5 — production rollout

- Back up and restore-test the current database.
- Provision the legacy/current tenant and migrate current data.
- Deploy control plane and tenant resolver behind feature flags.
- Run production smoke tests for current tenant.
- Provision customer 1, complete UAT, monitor, then provision customer 2.
- Configure uptime/error monitoring, daily backups and monthly restore drills.

Gate: signed UAT, backup evidence, zero critical logs and rollback procedure verified.

### Phase 6 — payment automation, only after stable launch

Create a gateway interface and add SSLCommerz/bKash/Nagad/Stripe as business demand
requires. Webhooks must be signature-verified, persisted before processing, idempotent and
replayable. A webhook never directly grants access without reconciling invoice amount,
currency and tenant.

## 8. Required API surface

```text
POST   /api/platform/auth/sign-in
GET    /api/platform/me
GET    /api/platform/tenants
POST   /api/platform/tenants
GET    /api/platform/tenants/:tenantId
PATCH  /api/platform/tenants/:tenantId
POST   /api/platform/tenants/:tenantId/provision
POST   /api/platform/tenants/:tenantId/invitations

GET    /api/platform/plans
POST   /api/platform/plans
PATCH  /api/platform/plans/:planId

GET    /api/platform/subscriptions
POST   /api/platform/subscriptions
POST   /api/platform/subscriptions/:id/change-plan
POST   /api/platform/subscriptions/:id/suspend
POST   /api/platform/subscriptions/:id/reactivate
POST   /api/platform/subscriptions/:id/cancel

GET    /api/platform/invoices
POST   /api/platform/invoices/:id/issue
POST   /api/platform/invoices/:id/payments
POST   /api/platform/payments/:id/verify
POST   /api/platform/payments/:id/reject

GET    /api/platform/audit-events
GET    /api/tenant/billing/summary
GET    /api/tenant/billing/invoices
GET    /api/tenant/usage
```

All list endpoints need pagination, filters and maximum page-size limits. Every mutation
needs request validation, authorization, audit logging and an idempotency strategy.

## 9. Pricing model for the first two customers

Use a proposal with four separate numbers instead of hiding all work in a monthly fee:

1. one-time onboarding/setup fee;
2. recurring monthly or annual subscription;
3. usage/pass-through costs such as SMS, email, payment gateway and domain;
4. optional custom development or migration at a stated hourly/fixed rate.

Do not promise unlimited users, unlimited storage or unlimited support. Define doctors,
staff, locations, monthly appointments, storage, support response target and backup
retention. Give an annual prepayment discount only if cash flow and support cost allow it.

## 10. What a customer receives

- tenant URL and, if purchased, custom-domain setup;
- owner invitation (never a password sent in plain text);
- configured hospital profile, locations, roles and opening hours;
- admin and staff onboarding session;
- short admin/user SOP and support contact;
- subscription order, invoice and payment receipt;
- privacy/data-processing terms and data ownership/export policy;
- support hours, severity definitions and response targets;
- backup/retention statement and incident contact;
- UAT checklist and signed go-live acceptance.

The standard SaaS package does **not** include GitHub access, source code, Vercel access,
MongoDB credentials or shared platform secrets. Those are provided only under a separate
source-code/white-label/enterprise licence with a materially different price and contract.

## 11. Security and healthcare minimums

- TLS everywhere; secure, httpOnly cookies; short access tokens and rotating/revocable
  refresh sessions.
- MFA for platform and tenant owners before commercial launch.
- Encrypt secrets in a managed secret store; never keep tenant URIs in business records.
- Least-privilege database users and separate production/staging credentials.
- Append-only audit history for login, role, subscription, payment, export and patient-data
  access.
- Rate limits and lockout protections shared across instances.
- Malware/type/size validation for uploads and tenant-prefixed object paths.
- Daily automated backups, retention policy and restore drills.
- Error monitoring, uptime checks, request IDs and sensitive-data redaction.
- A documented breach/incident process and local legal review for healthcare/privacy
  obligations before storing real patient data.

## 12. Definition of SaaS-ready

Hospitalia is not SaaS-ready merely because Tenant and Subscription collections exist.
Release requires:

- two-tenant automated isolation tests across all sensitive resources;
- authenticated platform and tenant roles with denial tests;
- enforceable subscription states and limits;
- idempotent provisioning and payment operations;
- migrated legacy data with reconciliation counts;
- backup restore evidence;
- staging and production smoke tests;
- customer UAT and signed commercial/privacy documents;
- clean builds, tests, logs and documented rollback.

