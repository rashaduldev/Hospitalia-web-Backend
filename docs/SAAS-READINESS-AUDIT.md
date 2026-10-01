# Hospitalia SaaS Readiness Audit

Date: 2026-10-01

## Executive result

The current Hospitalia application is a working single-environment healthcare platform,
but it is **not yet safe to onboard two isolated subscription customers**. The UI and
operational workflows are reusable; the tenant, subscription and control-plane boundaries
must be implemented before customer data is loaded.

## Current-state findings

| Area | Current behavior | SaaS risk | Required change |
| --- | --- | --- | --- |
| Database connection | One global `MONGODB_URI`/Mongoose connection. | Every customer shares the same unrestricted data context. | Control-plane DB plus server-resolved per-tenant database connections. |
| Identity | `User` contains a global unique phone and a global role/user type. | Cannot safely express one person's membership/role in multiple tenants. | Platform identity + tenant membership for administrators; tenant-local clinical identity initially. |
| Authorization | `ADMIN` user plus role strings such as `SUPER_ADMIN`. | Platform and customer administrators are not separate security principals. | Dedicated platform routes/claims and tenant role policy. |
| Tenant resolution | No domain/tenant resolver. | Requests cannot establish a trusted customer boundary. | Verified-domain resolver before data-plane access. |
| Data models | Doctor, Patient, Hospital, Appointment and related models have no enforced tenant context. | Guessed IDs or unscoped queries can cross customer boundaries. | Load models only from the resolved tenant connection and test denial paths. |
| Subscription | No plan, subscription, invoice, payment, grace or entitlement model. | Payment state cannot control service access or limits. | Versioned control-plane commercial models and lifecycle middleware. |
| Onboarding | Public hospital sign-up creates an operational user directly. | Customer provisioning is not reviewed, idempotent or auditable. | Super Admin tenant creation + expiring owner invitation + provisioning job. |
| Audit | Operational logs exist, but no append-only business/security audit model. | Cannot evidence admin, payment, export or role actions. | Append-only control-plane audit events and request IDs. |
| Existing admin UI | Current Hospitalia admin pages operate on global platform data. | A customer admin could be confused with platform-wide authority. | Split platform Super Admin from tenant admin navigation/APIs. |
| `dashboard-v2` | Separate Laravel/Vite commerce dashboard, currently single-tenant. | Reusing its backend duplicates auth/data and imports unrelated commerce scope. | Reuse selected frontend shell components only; bind them to Hospitalia control-plane APIs. |
| Backups/offboarding | Production deployment exists; tenant-specific restore/export is absent. | Cannot restore or delete one customer's data independently. | Per-tenant backups, export jobs, retention and deletion evidence. |

## Code-specific migration hazards

- Numeric counters and unique IDs currently operate globally; per-database counters will
  become tenant-local. URLs and APIs must always carry trusted tenant context so identical
  numeric IDs in two databases are harmless.
- JWTs currently contain user ID, user type, roles and token version only. Tenant and
  membership claims plus issuer/audience/session controls are required.
- `hospitalSignUp` currently allows direct hospital registration. It must be retained only
  for a documented marketplace flow or disabled in favour of tenant-owner invitations.
- Current admin dashboard aggregation queries all records. They must become either
  tenant-data dashboards or explicit platform aggregates sourced through controlled jobs.
- Search and public booking currently run without a tenant domain. SaaS deployment must
  decide whether the root domain is a marketing page, a legacy tenant, or a separately
  designed marketplace; it must not silently aggregate isolated customer databases.
- Existing production data needs a named legacy tenant and reconciliation. It must not be
  treated as unowned/default data indefinitely.

## What is reusable

- Doctor, hospital, patient, secretary, schedule, appointment and booking workflows.
- Next.js tenant-facing interface and server-action API layer.
- Existing authentication UX, after its tokens and onboarding behavior are updated.
- Existing backend response conventions, validation/error middleware and integration-test
  structure.
- Selected dashboard-v2 layout, table, form and chart components after removing commerce
  concepts and binding them to Hospitalia control-plane APIs.

## Immediate no-go conditions

Do not onboard both customers into the current production database or create two admins
and rely on role checks. Do not accept an `X-Tenant-Id` header as the isolation mechanism.
Do not clone and manually maintain two drifting codebases. Do not promise automated
payment, healthcare compliance or unlimited support before those capabilities and terms
are verified.

## First implementation milestone

The first safe coding milestone is a tested control-plane vertical slice:

1. separate control-plane connection/configuration;
2. Tenant, Domain, PlatformUser, Membership, Plan, Subscription and AuditEvent models;
3. platform Super Admin authentication/authorization;
4. create/list/read tenant APIs with validation and audit;
5. create plan/subscription APIs;
6. integration tests proving normal Hospitalia admins cannot access platform routes.

This milestone does not yet permit customer onboarding. Customer onboarding becomes safe
only after tenant data-plane routing, migration and cross-tenant denial tests pass.

