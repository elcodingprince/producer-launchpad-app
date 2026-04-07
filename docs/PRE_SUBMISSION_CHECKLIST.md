# Producer Launchpad Pre-Submission Checklist

Focused checklist based only on our completed audits and the current codebase.

## Workflow Rule

- After each completed privacy or legal task, immediately update the matching public page in [producer-launchpad-site](/Users/payan/producer-launchpad-site) while the implementation context is still fresh.
- Keep all public wording conservative until the underlying behavior is actually complete.
- Still do one final consistency pass at the end across app code, docs, and published site pages before submission.

## 1. Privacy & Data (From Our Audit)

- [ ] Implement deletion of uploaded merchant file objects from app-managed Cloudflare R2 during uninstall and `shop/redact`.
  Audit: privacy audit
  Status: ⏳ Pending verification
  File/component to modify: [shopDeletionJobs.server.ts](/Users/payan/producer-launchpad-app/app/services/shopDeletionJobs.server.ts), [r2.server.ts](/Users/payan/producer-launchpad-app/app/services/r2.server.ts), [webhooks.tsx](/Users/payan/producer-launchpad-app/app/routes/webhooks.tsx), [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts), then confirm hosted behavior and keep [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro) aligned

- [ ] Decide and implement the real retention rule for customer-related core records that currently persist until a trigger occurs, then update code to match that rule.
  Audit: privacy audit
  Status: ⏳ Pending verification
  File/component to modify: [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts), [data-retention-policy.md](/Users/payan/producer-launchpad-app/docs/data-retention-policy.md), then immediately update [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro) and [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro)

- [ ] Convert privacy cleanup from event-driven-only behavior into a dependable scheduled or operationally guaranteed process if we want to make time-bound deletion claims.
  Audit: privacy audit
  Status: ⏳ Pending verification
  File/component to modify: [shopDeletionJobs.server.ts](/Users/payan/producer-launchpad-app/app/services/shopDeletionJobs.server.ts), [api.internal.shop-deletion-jobs.tsx](/Users/payan/producer-launchpad-app/app/routes/api.internal.shop-deletion-jobs.tsx), [FLY_DEPLOYMENT.md](/Users/payan/producer-launchpad-app/docs/FLY_DEPLOYMENT.md), [RENDER_DEPLOYMENT.md](/Users/payan/producer-launchpad-app/docs/RENDER_DEPLOYMENT.md), then confirm production scheduling and keep [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro) aligned

- [ ] Finish the customer data request flow so it is not just stored for manual review, or narrow the policy language to explicitly say fulfillment is merchant-reviewed and operational.
  Audit: privacy audit
  Status: ⏳ Pending verification
  File/component to modify: [privacyRequests.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyRequests.server.ts), [app.privacy-requests.tsx](/Users/payan/producer-launchpad-app/app/routes/app.privacy-requests.tsx), [privacy-policy-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/privacy-policy-app-behavior-draft.md), then immediately update [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro)

- [ ] Verify hosted delivery of `customers/data_request`, `customers/redact`, and `shop/redact` against the intended production-like environment and capture evidence.
  Audit: privacy audit
  Status: ✅ Completed
  File/component to modify: [shopify.app.staging.toml](/Users/payan/producer-launchpad-app/shopify.app.staging.toml), [webhooks.tsx](/Users/payan/producer-launchpad-app/app/routes/webhooks.tsx), then immediately tighten or confirm [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro)
  Verification note: Sample webhook deliveries were triggered against `https://producer-launchpad-staging.fly.dev/webhooks` on April 5, 2026 / April 6, 2026 UTC. Staging logs showed `CUSTOMERS_DATA_REQUEST` at `2026-04-06T01:34:33Z`, `CUSTOMERS_REDACT` at `2026-04-06T01:34:34Z`, and `SHOP_REDACT` at `2026-04-06T01:34:57Z`, each followed by `POST /webhooks 200`.

## 2. Legal & Disclaimers (From Guardrail Audit)

- [ ] Add the legal disclaimer/guardrail step to onboarding or initial setup so merchants see it before relying on starter legal templates, not only when editing inside Licenses.
  Audit: guardrail audit
  Status: ✅ Completed
  File/component to modify: [app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx), [LegalGuardrailModal.tsx](/Users/payan/producer-launchpad-app/app/components/LegalGuardrailModal.tsx), then immediately update [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro) if disclaimer wording changes
  Verification note: Onboarding now requires the publishing acknowledgment checkbox before setup can finish, preserves completion on return visits, and no longer shows a redundant upload blocker after acceptance.

- [ ] Keep starter-template guardrails enforced at save time and confirm they also cover the first meaningful template-use path, not just template editing.
  Audit: guardrail audit
  Status: ✅ Completed
  File/component to modify: [app.licenses.tsx](/Users/payan/producer-launchpad-app/app/routes/app.licenses.tsx), related template-use flows, then immediately update [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro) if user-facing legal reliance language changes
  Verification note: Starter licenses still require the dedicated guardrail before edit/save, the custom-license flow uses a separate aligned acknowledgment, and copy now distinguishes acknowledgment from actual term review.

- [ ] Replace the public site’s generic privacy language with the implementation-aligned version that names actual providers, real 90-day cleanup windows, merchant-reviewed data request handling, and the current storage-deletion limitation.
  Audit: privacy audit
  Status: ✅ Completed
  File/component to modify: [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro), [privacy-policy-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/privacy-policy-app-behavior-draft.md)

- [ ] Replace the public merchant terms page with the implementation-aligned version that matches the real feature set, retention behavior, disclaimers, and merchant responsibilities.
  Audit: privacy audit + guardrail audit
  Status: ✅ Completed
  File/component to modify: [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro), [terms-of-service-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/terms-of-service-app-behavior-draft.md)

## 3. App Listing Assets

- [ ] Write final app listing description copy that matches the actual current service: license generation, secure delivery, delivery emails, and privacy request handling without overstating automation.
  Audit: code review + privacy audit
  Status: ❌ Not Started
  File/component to modify: Shopify Partner Dashboard listing fields, source draft in [PUBLIC_LISTING_SUBMISSION_PLAN.md](/Users/payan/producer-launchpad-app/PUBLIC_LISTING_SUBMISSION_PLAN.md)

- [ ] Capture screenshots for the flows we are actually shipping and want reviewers to understand quickly: onboarding/setup, beat upload, licenses, deliveries, and privacy requests.
  Audit: code review
  Status: ❌ Not Started
  File/component to modify: reviewer asset set; reference flows in [app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx), [app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx), [app.licenses.tsx](/Users/payan/producer-launchpad-app/app/routes/app.licenses.tsx), [app.deliveries.tsx](/Users/payan/producer-launchpad-app/app/routes/app.deliveries.tsx), [app.privacy-requests.tsx](/Users/payan/producer-launchpad-app/app/routes/app.privacy-requests.tsx)

- [ ] Confirm support contact, privacy policy URL, and terms URL in the app listing all point to the final published pages and match the contact shown in the docs.
  Audit: privacy audit + code review
  Status: ⏳ Pending
  File/component to modify: Shopify Partner Dashboard listing fields, [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro), [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro)

## 4. Final Verification

- [ ] Do a final claim-by-claim check that code, retention behavior, deletion behavior, and public policy text all match exactly before submission.
  Audit: privacy audit
  Status: ⏳ Pending
  File/component to modify: [privacy-compliance-audit-2026-04-05.md](/Users/payan/producer-launchpad-app/docs/privacy-compliance-audit-2026-04-05.md), public site legal pages, relevant privacy services

- [ ] Test the reviewer-critical end-to-end flows in the hosted environment: onboarding/setup → upload → license review/guardrail → order delivery → privacy request handling.
  Audit: code review + guardrail audit + privacy audit
  Status: ⏳ Pending
  File/component to modify: hosted app flows in [app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx), [app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx), [app.licenses.tsx](/Users/payan/producer-launchpad-app/app/routes/app.licenses.tsx), [webhooks.orders-create.tsx](/Users/payan/producer-launchpad-app/app/routes/webhooks.orders-create.tsx), [app.privacy-requests.tsx](/Users/payan/producer-launchpad-app/app/routes/app.privacy-requests.tsx)
