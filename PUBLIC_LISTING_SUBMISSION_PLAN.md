# Producer Launchpad Public Listing Submission Plan

## Goal

Submit `Producer Launchpad` as a `limited-visibility public app` once the app is technically stable, review-ready, and backed by finalized billing, privacy, and listing materials.

## Current Verdict

Current status: not ready to submit.

Working from the latest audit, the main blockers are now:

- the app stores protected customer and order-linked data, but the privacy/legal materials in `docs/` are still draft-only
- the `customers/data_request` workflow is captured and reviewable, but fulfillment is still an operational/manual queue rather than a fully hardened launch process
- there is no Shopify-native billing implementation in the runtime code, so the app is not ready for a paid public launch
- protected customer data posture needs explicit Partner Dashboard verification and reviewer-ready justification
- review materials such as hosted policy URLs, testing instructions, test credentials, and screencast still need explicit submission prep
- production dependency vulnerabilities still need triage before public review

## What Is Already In Good Shape

- production app URL and redirect URL are set in `shopify.app.toml`
- the app is configured as embedded and the Remix app shell is using embedded behavior
- compliance webhook topics are configured for `customers/data_request`, `customers/redact`, and `shop/redact`
- `npm run build` passes
- `npm run lint` passes once dependencies are installed

## Launch Blockers

### 1. Confirm the distribution and monetization path

Why this matters:

- limited visibility is still a public app, so it carries full public-app review expectations
- if the app is meant to be paid through Shopify, the current build is missing the billing layer needed for launch
- if the app is meant to stay free for now, that decision should be explicit in the listing and roadmap

Files to review:

- `package.json`
- `app/`
- Partner Dashboard distribution settings

Current issue:

- there is no `billing`, `requireBilling`, `appSubscription`, `oneTimePurchase`, or managed-pricing integration in the runtime code

Actions:

- decide whether this launch is:
  - free public pilot
  - paid public pilot with managed pricing
  - paid public pilot with Billing API
- if paid, implement the required billing flow before submission
- if free, make that an intentional launch decision and remove any ambiguous pricing assumptions from submission materials

Definition of done:

- the app's launch distribution and monetization path are aligned
- if the app has charges, Shopify-native billing is implemented and tested
- reinstall and post-approval flows behave correctly for the chosen billing path

### 2. Finalize privacy, policy, and merchant-facing legal materials

Files to review:

- `docs/privacy-policy.md`
- `docs/merchant-data-processing.md`
- `docs/data-retention-policy.md`
- `docs/README.md`

Current issue:

- the repo includes strong draft compliance materials, but they are still explicitly marked draft and not yet ready to serve as public listing assets

Actions:

- turn the privacy policy into a final hosted public URL
- finalize merchant-facing terms or data-processing disclosure
- make sure the hosted policy language matches the app's real data flows
- confirm the support/privacy contact used in the docs is the one you want in production

Definition of done:

- privacy policy and terms/data-processing materials are finalized, hosted, and linkable from the Shopify submission
- the text accurately reflects current app behavior and support ownership

### 3. Harden the privacy compliance workflow for `customers/data_request`

Files to review:

- `app/routes/webhooks.tsx`
- `app/services/privacyRequests.server.ts`
- `app/routes/app.privacy-requests.tsx`
- `docs/data-retention-policy.md`

Current issue:

- the app records, structures, and surfaces data requests well, but fulfillment still depends on manual in-app review and the retention automation is not fully implemented

Actions:

- document the exact operating procedure for fulfilling a Shopify data request inside the required timeline
- verify the export payload contains the complete and minimum necessary order/customer data
- define who marks requests fulfilled and where the export is delivered or stored during handling
- add or schedule the retention cleanup work called out in `docs/data-retention-policy.md`
- test all three compliance webhook topics end to end

Definition of done:

- `customers/data_request`, `customers/redact`, and `shop/redact` all have complete, tested behavior
- support has a written fulfillment playbook
- retention handling is implemented in code or operations, not only documented

### 4. Verify protected customer data posture and scope discipline

Files to review:

- `shopify.app.toml`
- `app/shopify.server.ts`
- `prisma/schema.prisma`
- Partner Dashboard protected customer data request

Current issue:

- the app stores customer name, email, order identifiers, audit metadata, and executed agreement records, so the protected customer data request needs to precisely match real usage and be reviewer-defensible

Actions:

- list the exact customer and order-linked fields that are stored
- confirm every requested scope is justified by current features
- verify the Partner Dashboard protected customer data request matches the real data footprint
- prepare a concise reviewer explanation of why each protected field is needed

Definition of done:

- requested scopes match actual app behavior
- protected customer data request is complete and aligned with the app's real storage and processing
- reviewer notes are ready if Shopify asks for justification

### 5. Prepare the full submission package

These may live outside the repo, but they must be ready before submission.

Checklist:

- privacy policy URL
- terms of service or merchant data-processing URL
- support contact email
- emergency developer contact in Partner Dashboard
- testing instructions
- valid test credentials
- short screencast showing onboarding and core flows
- clear explanation of any required merchant setup for the checkout extension

Definition of done:

- every required field in the app submission form is complete, current, and tested
- a reviewer can install, onboard, test delivery, and validate compliance without extra hand-holding

### 6. Run final production QA and dependency triage

Technical checks:

- production install
- reinstall
- embedded admin navigation
- core onboarding flow
- beat creation flow
- checkout extension happy path
- delivery portal happy path
- webhook delivery path for `orders/create`
- privacy webhooks
- error states and recovery

Repo checks:

- `npm run build`
- `npm run lint`
- review `npm audit --omit=dev`
- decide which production vulnerabilities must be fixed before public review and which are accepted short-term with rationale

Operational checks:

- verify Fly production secrets and environment separation
- confirm the single-machine SQLite deployment is acceptable for the initial limited rollout
- define rollback/support steps for failed delivery or webhook issues

Definition of done:

- the submitted version is the one that was tested
- known dependency and ops risks are explicitly triaged, not ignored

## Recommended Submission Order

1. Confirm whether this launch is free or paid, and choose the billing path accordingly.
2. Finalize and host privacy and legal materials.
3. Harden and document the privacy-request fulfillment workflow.
4. Verify protected customer data request details and scope justification in Partner Dashboard.
5. Prepare the listing package, reviewer instructions, test credentials, and screencast.
6. Run final production QA and dependency triage on the exact version to be submitted.
7. Submit as a limited-visibility public app.

## Smallest Safe Path To Limited-Visibility Submission

If the goal is to get to submission with the fewest changes that still feel responsible:

1. Decide whether the first public launch is free or whether billing must ship first.
2. Publish the privacy policy and merchant-facing legal/docs URLs.
3. Finalize the written fulfillment process for `customers/data_request` and test all compliance webhooks.
4. Confirm protected customer data access details and reviewer justification in Partner Dashboard.
5. Prepare test credentials, testing instructions, screencast, support contact, and emergency contact.
6. Re-run build, lint, and production smoke tests on the final candidate.

If any of those six items are incomplete, delay submission.

## Open Questions To Resolve Before Submission

- Is the first limited-visibility launch free, or does it need Shopify-native billing on day one?
- If paid, do you want managed pricing or Billing API?
- Where will the final privacy policy be hosted?
- Where will the final terms of service or merchant data-processing terms be hosted?
- What exact operating procedure will fulfill `customers/data_request` from receipt to closure?
- Has protected customer data access already been requested and approved in the Partner Dashboard?
- Are the current Fly/SQLite production constraints acceptable for the first public pilot?

## Notes

- Limited visibility is still a public App Store listing, so normal public-app review expectations still apply.
- The repo no longer appears blocked by placeholder production URLs.
- The embedded-app mismatch previously noted is no longer present.
- `npm run build` passed during audit.
- `npm run lint` passed after installing dependencies.
- `npm audit --omit=dev` still reports production vulnerabilities and should be triaged before launch.
