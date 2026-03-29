# Protected Customer Data Requirements Plan

## Why This Matters

Shopify's protected customer data requirements are not just review hints. They are published requirements for public apps that use protected customer data.

Official docs:

- [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements)

Important rule:

- If the app uses protected customer data including `name`, `address`, `phone`, or `email`, Shopify says the app must meet **all Level 1 and Level 2 requirements**.

Because Producer Launchpad uses at least customer `email` and likely `name`, we should plan as a **Level 2** app.

## Official Requirement Mapping

The form questions map closely to Shopify's requirement list in the protected customer data docs.

### Level 1

1. Process only the minimum personal data required.
2. Inform merchants what personal data is processed and why.
3. Limit processing to the stated purposes.
4. Respect customer consent decisions where applicable.
5. Respect opt-out of data sharing/sale where applicable.
6. Allow opt-out of automated decision-making with legal/significant effects where applicable.
7. Make privacy and data protection agreements with merchants.
8. Apply retention periods so personal data is not kept longer than needed.
9. Encrypt data at rest and in transit.

### Level 2

10. Encrypt data backups.
11. Keep test and production data separate.
12. Have a data loss prevention strategy.
13. Limit staff access to protected customer data.
14. Require strong passwords for staff accounts.
15. Keep an access log to protected customer data.
16. Implement a security incident response policy.

## Current Producer Launchpad Assessment

This is a practical assessment based on the current repo and what we know today.

### Likely already supportable

- Minimum data: partially, if we keep scope tight to `email` and only keep `name` if truly necessary.
- Stated purpose limitation: partially, app behavior is narrow and operational.
- Consent / opt-out of sale / automated decision-making: likely `Not applicable` because the app is not a marketing, ad-tech, or profiling app.
- Test and production separation: supportable once we keep dev store/dev infrastructure separate from production.

### Clearly incomplete today

- Merchant-facing privacy disclosure and privacy policy.
- Privacy / data protection agreement language with merchants.
- `customers/data_request` fulfillment flow.
- Formal retention schedule.
- Verified production encryption posture at rest and in transit.
- Verified encrypted backups.
- Formal DLP strategy.
- Staff access policy.
- Strong-password policy for staff accounts.
- Access logging for protected data.
- Security incident response policy.

### Already helpful in the repo

- Compliance webhook topics are configured in `shopify.app.toml`.
- `customers/redact` and `shop/redact` are implemented in `app/routes/webhooks.tsx`.
- Storage credentials are encrypted before persistence in `app/services/storageConfig.server.ts`.

### Still a real blocker in the repo

- `customers/data_request` currently logs matching records but does not complete a fulfillment workflow.

## Minimum Truthful Submission Goal

The goal is not to force the form today.

The goal is to reach a state where we can honestly answer:

- `Yes` to the required operational and security questions
- `Not applicable` only where Shopify's own wording makes that appropriate

## Minimum Scope Decision

Before implementing anything else, keep the protected customer fields as narrow as possible.

Recommended:

- Keep `Email`.
- Keep `Name` only if the buyer's name is truly required on generated license agreements.
- Do not request `Phone`.
- Do not request `Address`.

Note:

- Even `Email` alone still puts us in the stricter bucket per Shopify's published guidance, so this narrows exposure but does not eliminate Level 2 requirements.

## Implementation Plan

## 1. Privacy and Merchant Disclosure

### Goal

Meet the requirements to:

- tell merchants what personal data is processed and why
- make privacy/data protection agreements with merchants
- support the App Store privacy policy requirement

### Work

- Create a public privacy policy page.
- Create merchant-facing terms or a short data processing section that explains:
  - what customer data the app processes
  - why it processes it
  - how long it retains it
  - how merchants can contact us
  - how data rights requests are handled
- Add those URLs to the Shopify listing before submission.

### Producer Launchpad-specific policy content

Document that the app processes only the data needed to:

- associate purchases with buyers
- generate digital license agreements
- create secure delivery access for purchased files
- support re-delivery and privacy compliance

### Output

- `docs/privacy-policy.md` or hosted privacy page source
- `docs/merchant-data-processing.md` or equivalent terms section

## 2. Complete Privacy Webhook Fulfillment

### Goal

Finish the data rights workflow required for public apps.

### Work

- Keep existing `customers/redact` and `shop/redact` behavior.
- Implement a real `customers/data_request` workflow:
  - collect the matching customer/order data
  - sanitize it
  - store a fulfillment record
  - expose it for internal review/export
  - mark it fulfilled when handled

### Suggested implementation

- Add a Prisma model such as `PrivacyDataRequest`.
- Store:
  - shop
  - Shopify request id
  - customer identifiers used to match
  - raw webhook payload
  - generated export JSON
  - status
  - fulfilledAt
- Add an internal admin route or script to review/export pending requests.

### Output

- Prisma migration
- updated `app/routes/webhooks.tsx`
- optional admin page like `app/routes/app.privacy-requests.tsx`

## 3. Retention Policy

### Goal

Answer `Yes` to retention periods and align app behavior with that claim.

### Work

- Decide and document retention windows for:
  - delivery access records
  - order audit fields
  - executed agreements
  - logs
  - backup retention
- Implement scheduled cleanup or archival rules.

### Suggested minimal policy

- Delivery records: retain only as long as needed for delivery support and dispute handling.
- Audit metadata: retain for a defined support/compliance period.
- Privacy request exports: retain for a short compliance window.
- Deleted shops/customers: remove promptly through compliance flows.

### Output

- `docs/data-retention-policy.md`
- cleanup task or script

## 4. Production Hosting and Encryption

### Goal

Be able to truthfully answer:

- encrypt data at rest and in transit
- encrypt backups

### Work

- Choose production hosting that gives:
  - HTTPS/TLS in transit
  - encrypted managed database/storage at rest
  - encrypted backups
- Document the controls from the provider.

### Practical minimum

- Use a managed platform with TLS enabled by default.
- Use a managed production database with encryption at rest.
- Use storage/backups that are encrypted by the provider.

### Output

- `docs/infrastructure-security.md`
- provider checklist with evidence links/screenshots

## 5. Environment Separation

### Goal

Answer `Yes` to separating test and production data.

### Work

- Maintain separate:
  - app URLs
  - Shopify app version/config if needed
  - databases
  - storage buckets
  - environment variables
- Do not copy production customer/order data into dev.

### Output

- `docs/environment-separation.md`

## 6. Data Loss Prevention Strategy

### Goal

Meet Shopify's DLP-style expectation at a practical small-team level.

### Minimal realistic strategy

- restrict who can access production systems
- keep production credentials in a secrets manager / host env vars only
- avoid downloading/exporting personal data locally unless required
- log and review sensitive access
- define how exports are handled and deleted

### Output

- `docs/data-loss-prevention.md`

## 7. Staff Access Controls

### Goal

Answer `Yes` to limiting staff access and strong passwords.

### Work

- Define which accounts can access:
  - production app hosting
  - production database
  - storage
  - email provider
  - Shopify Partner Dashboard
- Use least privilege.
- Require strong passwords and MFA on provider accounts where supported.

### Output

- `docs/access-control-policy.md`

## 8. Access Logging

### Goal

Answer `Yes` to logging access to personal data.

### Minimum viable approach

- Log admin actions that expose customer-linked delivery data or privacy exports.
- Use provider audit logs where available for infra access.
- Keep application logs for:
  - privacy request creation/export
  - manual resend of customer-linked delivery emails
  - access to privacy-export tooling

### Output

- app-level audit log plan
- provider audit log evidence list

## 9. Security Incident Response Policy

### Goal

Answer `Yes` to having a security incident response policy.

### Minimum viable document

- how incidents are identified
- who is responsible
- how credentials are rotated
- how affected systems are contained
- how evidence is preserved
- how merchants are notified when required

### Output

- `docs/security-incident-response.md`

## Form Strategy Once Implemented

After the items above are implemented, the target answers should look like:

- Minimum personal data required: `Yes`
- Tell merchants what data is processed and why: `Yes`
- Limit use to stated purpose: `Yes`
- Privacy/data protection agreements with merchants: `Yes`
- Respect customer consent decisions: `Not applicable` unless the app starts using consent-based marketing/tracking
- Respect opt-out of data sold/shared: `Not applicable`
- Automated decision-making opt-out: `Not applicable`
- Retention periods: `Yes`
- Encrypt data at rest and in transit: `Yes`
- Encrypt backups: `Yes`
- Separate test and production data: `Yes`
- Data loss prevention strategy: `Yes`
- Limit staff access: `Yes`
- Strong password requirements: `Yes`
- Log access to personal data: `Yes`
- Security incident response policy: `Yes`

## Recommended Execution Order

1. Decide whether `Name` is truly required.
2. Implement `customers/data_request`.
3. Write privacy policy and merchant data-processing disclosures.
4. Define retention policy.
5. Choose production infrastructure with encryption/backups.
6. Define environment separation and access controls.
7. Add access logging and incident response documentation.
8. Revisit the Partner Dashboard protected customer data form.

## Smallest Honest Path To Submission

If we want the shortest truthful route:

1. Keep protected fields to the minimum.
2. Finish privacy webhooks and request handling.
3. Add privacy policy and merchant disclosure docs.
4. Move onto production infrastructure that provides encryption and encrypted backups.
5. Create lean but real internal policies for retention, access control, DLP, and incident response.

## Repo Tasks We Can Do Now

- Implement `customers/data_request` handling.
- Add internal privacy-request review tooling.
- Add docs under a `docs/` folder for:
  - privacy policy draft
  - retention policy
  - access control
  - DLP strategy
  - incident response
- Add lightweight audit logging around privacy-related admin actions.

## Tasks That Require Infrastructure / Partner Dashboard

- hosting selection and deployment
- encrypted production database and backups
- production environment separation
- final App Store privacy policy URL
- final protected customer data request submission
