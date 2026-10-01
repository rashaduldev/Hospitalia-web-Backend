# Hospitalia Client Onboarding and Handoff Checklist

## Before accepting payment

- [ ] Customer legal name, address, tax information and authorized signer recorded.
- [ ] Hospital/clinic licence and responsible data owner identified.
- [ ] Included modules, locations, doctor/staff limits and storage limit written down.
- [ ] One-time setup fee and monthly/annual subscription agreed.
- [ ] SMS, email, payment gateway, domain and migration costs marked as included or extra.
- [ ] Support hours, response targets and excluded custom development agreed.
- [ ] Data-processing/privacy terms and termination/export rules reviewed locally.
- [ ] Order form/subscription agreement signed.
- [ ] Initial invoice issued and payment status recorded.

## Information to collect from the customer

- [ ] Hospital display and legal names, logo and brand colours.
- [ ] Address, phone, email, website, timezone, currency and supported languages.
- [ ] Locations/branches, opening hours and appointment types.
- [ ] Owner/admin name, verified email and phone.
- [ ] Doctors, departments, specialities and fee schedule.
- [ ] Staff roles and least-privilege access requirements.
- [ ] Existing data source and migration owner.
- [ ] Custom domain/DNS contact, if applicable.
- [ ] Billing contact and preferred payment method.
- [ ] Training attendees and go-live date.

Never request passwords through chat or spreadsheets. Send expiring invitations so each
person creates their own password.

## Internal provisioning

- [ ] Create tenant with immutable slug and selected plan.
- [ ] Provision isolated tenant database and least-privilege database user.
- [ ] Create required indexes and reference data idempotently.
- [ ] Configure and verify platform subdomain/custom domain.
- [ ] Create subscription, invoice and correct grace/renewal dates.
- [ ] Invite owner; confirm invitation expiry and single-use behavior.
- [ ] Configure hospital profile, locations, modules and limits.
- [ ] Import agreed data and reconcile source/target record counts.
- [ ] Run tenant-only API, browser, role and booking smoke tests.
- [ ] Verify no customer 1 data is visible using customer 2's domain or token.
- [ ] Confirm backup, monitoring and support contact are active.

## Customer UAT

- [ ] Owner/admin signs in and resets recovery information.
- [ ] Admin invites a staff member and assigns a restricted role.
- [ ] Doctor/location/profile appears correctly in public search.
- [ ] Test patient books, reschedules/cancels according to scope.
- [ ] Doctor/secretary sees the appointment and schedule.
- [ ] Hospital admin views operational dashboard and exports allowed data.
- [ ] Billing admin can see plan, limits and invoice but cannot verify payment.
- [ ] Mobile and desktop critical flows pass.
- [ ] Customer signs the UAT/go-live acceptance.

Delete or clearly label all test patient records before go-live.

## Handoff pack sent to the customer

- [ ] Tenant URL and custom domain.
- [ ] Owner invitation and account-recovery instructions.
- [ ] Admin and staff quick-start guides.
- [ ] Recorded/live training details.
- [ ] Signed order/agreement, invoice and payment receipt.
- [ ] Plan inclusions, limits and renewal date.
- [ ] Support channel, hours, severity definitions and response targets.
- [ ] Privacy/data ownership, export, retention and deletion summary.
- [ ] Backup/incident contact statement.
- [ ] Go-live acceptance copy.

Do not hand over source code, GitHub, Vercel, MongoDB or shared credentials under the
standard subscription. A source-code or white-label handoff requires a separate licence,
price, infrastructure transfer plan and security-secret rotation.

## Monthly operations

- [ ] Generate/issue renewal invoice.
- [ ] Reconcile payment and record provider/reference details.
- [ ] Review usage and approaching limits.
- [ ] Review failed logins, role changes, exports and platform overrides.
- [ ] Check errors, uptime, email/SMS failures and storage growth.
- [ ] Confirm automated backup success; perform scheduled restore drill.
- [ ] Send customer usage/service summary if included in plan.

## Offboarding

- [ ] Confirm cancellation authority, effective date and unpaid balance.
- [ ] Revoke invitations/sessions and enter contract-defined restricted mode.
- [ ] Produce approved export through an audited job.
- [ ] Customer confirms export receipt.
- [ ] Retain data only for the contracted/legal period.
- [ ] Remove domains/integrations, destroy tenant credentials and database after approval.
- [ ] Record deletion evidence and close the tenant without deleting billing/audit records
      that must legally remain.

