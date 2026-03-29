# Producer Launchpad Public Listing Submission Plan

## Goal

Submit `Producer Launchpad` for a public Shopify listing with limited visibility once the app is review-ready and the required listing/compliance materials are in place.

## Current Verdict

Current status: not ready to submit.

Reason:

- the active app config still points at placeholder URLs
- the privacy compliance flow for `customers/data_request` is incomplete
- the embedded app shell is configured inconsistently
- requested scopes look broader than the current code appears to require
- listing and policy assets are not present in this repo, so they still need explicit verification before submission

## Launch Blockers

### 1. Fix production app URLs and redirects

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

File to review:

- `app/routes/webhooks.tsx`

Current issue:

- the webhook logs matching records but does not actually fulfill the request workflow

Actions:

- define the exact response/operational path used when Shopify requests customer data
- gather and structure the stored customer/order data that must be supplied to the merchant
- document the fulfillment process so support can execute it reliably
- test the compliance webhook behavior end to end

Definition of done:

- `customers/data_request`, `customers/redact`, and `shop/redact` all have complete, tested behavior
- support knows how a data request is fulfilled within Shopify's required timeline

### 3. Fix embedded app configuration mismatch

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

Files to review:

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

### 5. Verify protected customer data access request

Because the app stores customer name/email and order-related records, confirm the Partner Dashboard protected customer data request is complete and justified.

Actions:

- list exactly which customer fields are used
- make sure the dashboard request matches that usage
- prepare a clear explanation of why each field is necessary

### 6. Add and verify listing/legal assets

These may live outside the repo, but they must be ready before submission.

Checklist:

- privacy policy URL
- terms of service URL
- support contact email
- emergency contact for review
- testing instructions
- valid test credentials
- short screencast showing onboarding and core flows

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

## Notes

- Limited visibility is still a public App Store listing, so normal public-app review expectations still apply.
- `npm run build` passed during audit.
- `npm run lint` currently fails because the repo does not include an ESLint config.
- `npm audit --omit=dev` currently reports unresolved vulnerabilities that should be triaged before launch.
