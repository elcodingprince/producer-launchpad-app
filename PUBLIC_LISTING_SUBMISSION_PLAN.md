# Producer Launchpad Public Listing Submission Plan

## Goal

Submit `Producer Launchpad` for a public Shopify listing with limited visibility once the app is review-ready and the required listing/compliance materials are in place.

## Current Verdict

Current status: technically close, but not yet ready to submit.

Reason:

- ✅ the active app config points at production URLs
- ✅ the privacy compliance flows for `customers/data_request`, `customers/redact`, and `shop/redact` are implemented in app code
- ✅ staging/dev validation confirmed that `customers/data_request` stores a request + export payload and matches the correct order
- ✅ staging/dev validation confirmed that `customers/redact` clears delivery/customer identity, clears order telemetry, redacts executed-agreement identity fields, and preserves redacted agreement proof artifacts
- ✅ `shop/redact` destructive behavior has been observed against staging/dev data
- ✅ the embedded app shell is configured consistently
- ✅ requested scopes have been reduced to match actual code usage (`write_orders` has been removed)
- ⚠️ live Shopify-to-app webhook delivery still needs to be verified against one known environment without local tunnel ambiguity
- ⚠️ listing and policy assets are managed in the landing page repo, requiring final Partner Dashboard verification and copy alignment

## Launch Blockers

### 1. Fix production app URLs and redirects

**Status: Complete** - Configs now correctly point to the production app.

Files to review:

- `shopify.app.toml`
- `shopify.app.producer-launchpad.toml`
- Partner Dashboard app URLs / redirect URLs

Actions:

- replace `https://example.com` with the real production app URL
- confirm the active app version in the Dev Dashboard uses the same URL
- verify install, reinstall, and auth callback behavior against the production URL
- verify the checkout extension `app_url` setting uses the same production host

Definition of done:

- install flow works from the production app listing
- reinstall works cleanly
- no placeholder URLs remain in active config or dashboard settings

### 2. Complete privacy compliance for `customers/data_request`

**Status: In app code complete; live webhook delivery verification still pending**

- `app/routes/webhooks.tsx`
- `app/services/privacyRequests.server.ts`
- `app/services/privacyCompliance.server.ts`

Current issue:

- the app logic is working in staging/dev, but a real Shopify webhook delivery test has not yet been conclusively observed in the intended environment

Actions:

- keep the internal operational fulfillment path for `customers/data_request`
- verify real Shopify webhook delivery against the staging app URL after deploying the latest privacy changes
- capture logs and DB evidence for:
  - `customers/data_request`
  - `customers/redact`
  - `shop/redact`
- document the fulfillment process so support can execute it reliably
- remove or tightly gate internal privacy test tooling before public submission

Definition of done:

- `customers/data_request`, `customers/redact`, and `shop/redact` all have complete, tested behavior in staging via real webhook delivery
- support knows how a data request is fulfilled within Shopify's required timeline

### 3. Fix embedded app configuration mismatch

**Status: Complete** - `isEmbeddedApp` is now correctly enabled.

File to review:

- `app/routes/app.tsx`

Current issue:

- app config says the app is embedded, but the Remix provider uses `isEmbeddedApp={false}`

Actions:

- align the app shell with embedded app behavior
- test navigation, redirects, App Bridge behavior, and session-token-backed flows after the change

Definition of done:

- app behaves consistently as an embedded Shopify admin app
- no review-visible switching between embedded and non-embedded experiences

### 4. Reduce scopes to least privilege

**Status: Complete** - `write_orders` and other unused scopes have been effectively removed from app configuration.

- `shopify.app.toml`
- `app/shopify.server.ts`
- `.env.example`

Current issue:

- the app requests broad scopes, including `write_orders`, that may not be justified by current code paths

Actions:

- audit every requested scope against real feature usage
- remove unused scopes from config and env defaults
- re-test install after scope changes
- if any sensitive scope must remain, prepare a short reviewer explanation

Definition of done:

- requested scopes match actual app behavior
- protected customer data request in the Partner Dashboard matches the app's real use

## Submission Readiness Tasks

### Listing Copy Draft

Use the following as the starting point for the Shopify Partner Dashboard listing.

#### App name

- `Producer Launchpad`

#### Tagline / short value proposition

- `Generate beat licenses, deliver files securely, and manage post-purchase delivery in Shopify.`

#### Short description

- `Producer Launchpad helps music producers generate license records, send secure delivery links, and manage digital beat fulfillment directly inside Shopify.`

#### Full description

Producer Launchpad helps music producers run digital beat sales inside Shopify with less manual follow-up.

Use Producer Launchpad to:

- generate license records tied to Shopify purchases
- manage reusable license templates
- upload beat files and map delivery packages
- send secure post-purchase delivery links
- track delivery email status and resend when needed
- support Shopify privacy-request and redaction handling through the app's compliance workflow

Producer Launchpad is built for producers who want a cleaner licensing and delivery workflow inside Shopify without stitching together multiple tools.

Important notes for review and merchant expectations:

- Producer Launchpad helps generate and deliver license records, but merchants remain responsible for reviewing and finalizing the license terms they use with buyers.
- Customer privacy requests are captured automatically, and Producer Launchpad support completes fulfillment operationally for the store owner within Shopify's required timeframe.
- Managed uploads are queued for deletion immediately on uninstall, and app-controlled records are removed through the app's uninstall and privacy-compliance workflows.

#### Feature bullets

- `License templates for common beat licensing tiers`
- `Secure delivery links for purchased digital files`
- `Managed beat upload and delivery mapping`
- `Delivery email tracking and resend support`
- `Shopify privacy webhook handling for access and deletion workflows`

#### Support contact

- `newradio.sound@gmail.com`

#### Policy URLs

- Privacy policy: use the final published `/privacy` page on the landing site
- Terms of service: use the final published `/terms` page on the landing site

#### Reviewer notes

- The app is embedded in Shopify Admin.
- Onboarding sets up producer identity, starter licenses, and required legal acknowledgment.
- License editing includes starter-template and custom-template guardrails.
- Customer data request handling is support-operated and not presented as a primary merchant-facing feature.
- Managed-storage deletion is queued immediately on uninstall and completed through the background deletion workflow.

### 5. Verify protected customer data access request

**Status: Pending** - Needs verification in the Partner Dashboard directly.

Because the app stores customer name/email and order-related records, confirm the Partner Dashboard protected customer data request is complete and justified.

Actions:

- list exactly which customer fields are used
- make sure the dashboard request matches that usage
- prepare a clear explanation of why each field is necessary
- align the dashboard request with the current implementation:
  - customer name/email for licensee identity and delivery
  - order identifiers and purchased license data for sold-license proof
  - limited short-term telemetry for security/compliance handling

### 6. Add and verify listing/legal assets

**Status: Hosted externally, but copy alignment still pending**

These may live outside the repo, but they must be ready before submission.

Checklist:

- privacy policy URL
- terms of service URL
- support contact email
- emergency contact for review
- testing instructions
- valid test credentials
- short screencast showing onboarding and core flows
- ensure the public privacy policy matches validated app behavior, including:
  - preserved agreement proof artifacts
  - customer-data redaction behavior
  - retention windows
  - compliance webhook handling

Definition of done:

- every required field in the app submission form is complete, current, and tested

### 7. Run production QA

Technical checks:

- production install
- reinstall
- core onboarding flow
- beat creation flow
- checkout extension happy path
- delivery portal happy path
- webhook delivery path for `orders/create`
- privacy webhooks
- error states and recovery
- staging deploy of the latest privacy changes
- one real webhook delivery verification pass against the staging app URL

Repo checks:

- `npm run build`
- establish a working lint setup, then run `npm run lint`
- review `npm audit --omit=dev` and decide what must be fixed before review

## Recommended Submission Order

1. Fix URLs and redirect settings.
2. Fix embedded app configuration.
3. Audit and reduce scopes.
4. Finish privacy compliance behavior for `customers/data_request`.
5. Verify protected customer data request in Partner Dashboard.
6. Complete listing assets, legal URLs, testing instructions, and screencast.
7. Run full production QA on the final submitted version.
8. Submit as a limited-visibility public app.

## Same-Day Minimum Path

If the goal is still to submit as soon as possible, this is the smallest safe path:

1. Replace placeholder production URLs everywhere.
2. Fix `isEmbeddedApp={false}`.
3. Remove unjustified scopes, especially `write_orders` unless it is truly required.
4. Complete and test the privacy-request workflow.
5. Confirm privacy policy, test credentials, support contact, and screencast are already ready in the Partner Dashboard.

If any of those five items are incomplete, delay submission.

## Open Questions To Resolve Before Submission

- What is the final production app URL?
- Do you truly need `write_orders`?
- Where is the privacy policy hosted?
- Where are the terms of service hosted?
- What exact process will fulfill `customers/data_request`?
- Has protected customer data access already been requested and approved in the Partner Dashboard?
- Has the latest privacy code been deployed to staging and verified through real Shopify webhook delivery?

## Notes

- Limited visibility is still a public App Store listing, so normal public-app review expectations still apply.
- `npm run build` passed during audit.
- `customers/data_request` and `customers/redact` were successfully validated against staging/dev data using an internal test harness:
  - `customers/data_request` created a `PrivacyDataRequest` row with matching export data
  - `customers/redact` cleared delivery identity, order telemetry, privacy export data, and agreement identity fields while preserving a redacted agreement artifact
- `shop/redact` destructive behavior was also observed in staging/dev and removed shop-scoped data as expected.
- `/app/privacy-test` now exists only as an internal route and should be enabled only with `ENABLE_INTERNAL_TEST_ROUTES=true` outside production.
- `npm run lint` currently fails because the repo does not include an ESLint config.
- `npm audit --omit=dev` currently reports unresolved vulnerabilities that should be triaged before launch.
