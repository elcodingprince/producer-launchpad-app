# Producer Launchpad Launch Plan

## Purpose

This is the single source of truth for the work between today's state and launch.

It replaces the overlapping delivery, continuation, and Resend implementation planning docs as the active roadmap.

This plan is intentionally optimized for:

- launching the current delivery product safely
- stopping feature churn at a clear point
- deferring non-launch-critical work until after release

---

## Current Status

### Already working

- beat upload creates live storefront products
- variant-based entitlement resolution is working
- order webhook persistence is working
- thank-you block can open the portal when the app URL is configured correctly
- tokenized download portal works
- secure file delivery through the app works
- multi-file audio packages now download as a ZIP
- merchant recovery exists through the Deliveries page
- delivery email V1 works through Resend
- merchant resend delivery email works from Deliveries
- Resend webhook-confirmed delivery states are implemented and tested behind a feature flag
- public portal no longer leaks the merchant app shell
- customer-facing portal failure states exist
- download counts are tracked

### What is still missing before launch

- stable hosted app URL and production app configuration
- checkout block moved off the dev-preview URL workflow
- final production validation on the hosted app domain
- launch checklist pass and hard freeze

---

## Hard Stop

Once all pre-launch phases below are complete and the launch checklist passes:

1. stop adding new product features
2. launch the app
3. only accept production bug fixes and launch-blocking corrections

Anything not required for safe selling moves to the post-launch backlog.

---

## Launch Definition

Producer Launchpad is ready to launch when:

- a customer can buy an existing beat on the live storefront
- the thank-you block opens the portal on the hosted app URL
- the delivery email arrives automatically with a working portal link
- the portal shows all purchased items in the order
- single-file licenses download correctly
- multi-file licenses download correctly as a ZIP
- the PDF license agreement downloads correctly
- merchants can copy a portal link, regenerate a token, and resend the delivery email
- merchants can see download activity and delivery email send state in Deliveries
- customer-facing failure states are clear enough that support can diagnose issues quickly

---

## What We Are Not Doing Before Launch

These are explicitly post-launch unless something becomes a hard blocker:

- token expiry and advanced token lifecycle rules
- rate limiting and abuse protection beyond current baseline
- customer self-serve recovery page
- customer-account / order-status account integration
- true merchant-branded sender domains
- attaching the PDF to delivery emails
- legal/PDF refinement work from [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/payan/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md)
- deeper analytics and monitoring dashboards

---

## Phase 1: Production Foundation

Goal: move the delivery system off dev-preview assumptions.

### Tasks

- host the app on a stable production domain
- set the stable app URL in Shopify app configuration
- update the checkout block to use the hosted app URL instead of the current changing preview-url workflow
- verify emailed portal links and thank-you block links both resolve to the same hosted domain
- verify Deliveries page portal-copy and token-regeneration actions produce hosted-domain links
- confirm Resend env values are correct in the hosted environment

### Exit criteria

- no delivery-critical flow depends on a changing preview URL
- checkout block and email recovery both target the hosted domain

---

## Phase 2: Merchant Operations Minimum

Goal: give merchants the support tools they need before launch.

### Tasks

- keep `Copy portal link` and `Regenerate access link` in the selected-row action area
- keep `Resend delivery email` in the selected-row action area
- preserve `Delivery email` badge states:
  - `Sent`
  - `Failed`
  - `Skipped`
  - `Unknown` for historical pre-email orders
- keep webhook-confirmed delivery mode ready for hosted cutover:
  - `Delivered`
  - `Bounced`
  - `Complained`
  - `Delayed`
- make sure new orders store real customer first/last names when Shopify provides them
- keep the Deliveries table compact and aligned with Shopify Admin table density

### Exit criteria

- merchant can recover access without Prisma or direct DB inspection
- merchant can manually resend the delivery email for a selected order

---

## Phase 3: Delivery Hardening

Goal: make the current flow safe enough to sell without continuing feature expansion.

### Tasks

- verify portal failure-state coverage for:
  - invalid token
  - missing mapping
  - partial delivery
  - missing downloadable items
  - generic fallback
- verify ZIP bundle delivery works for:
  - MP3 + WAV
  - MP3 + WAV + STEMS
  - mixed single-item and multi-item orders
- verify download counting behavior for:
  - single-file downloads
  - ZIP downloads
  - regenerated tokens
- confirm merchant-side token regeneration invalidates the old link immediately
- confirm delivery email failure does not block portal creation or merchant recovery

### Exit criteria

- the delivery system is reliable enough that support incidents are recoverable through the app

---

## Phase 4: Production Validation

Goal: prove the hosted app works end to end on real storefront purchases.

### Required live tests

- purchase one beat with one downloadable audio file
- purchase one beat with multiple downloadable audio files
- purchase multiple beats in a single checkout
- verify thank-you block portal access on the hosted domain
- verify automatic delivery email arrives for each qualifying order
- verify portal link from email works on the hosted domain
- verify PDF download works
- verify ZIP download works
- verify Deliveries page shows:
  - token access state
  - delivery email state
  - item count
  - included files
  - tracked downloads
- verify merchant can resend delivery email successfully

### Exit criteria

- all critical launch flows pass on the hosted environment, not only in preview/dev

---

## Phase 5: Launch Freeze

Goal: stop building and ship.

### Tasks

- complete the launch checklist below
- record any non-blocking issues as post-launch backlog items
- stop adding new product scope
- launch

---

## Launch Checklist

- [ ] Hosted app URL is live and stable
- [ ] Shopify app configuration uses the hosted URL
- [ ] Checkout block uses the hosted URL path successfully
- [ ] Delivery email sends automatically through Resend in production
- [ ] Delivery email sender/domain is correct
- [ ] Portal links in email open correctly
- [ ] Thank-you block opens the same portal correctly
- [ ] Single-file download works
- [ ] Multi-file ZIP download works
- [ ] PDF download works
- [ ] Deliveries page shows delivery email status badges
- [ ] Deliveries page shows compact customer and item popovers correctly
- [ ] Merchant can copy portal link
- [ ] Merchant can regenerate token
- [ ] Merchant can resend delivery email
- [ ] Customer-facing error states are acceptable
- [ ] At least one real hosted-domain test order has been completed successfully for each core order shape

---

## Post-Launch Backlog

These items should resume only after launch unless one becomes urgent.

### Delivery confirmation and email operations

- move Resend webhook confirmation from preview/dev to the stable hosted app URL
- keep `RESEND_WEBHOOKS_ENABLED` aligned with the hosted environment rollout
- decide whether `Delivery email` should remain badge-only or evolve into a richer detail model

### Delivery UX refinement

- richer status popovers for `Delivery email`
- richer merchant diagnostics for failed sends
- richer item/detail popovers if they still add value after launch feedback

### Access lifecycle and security

- token expiration
- token reissue policy beyond the current regenerate flow
- abuse protection and rate limiting

### Legal and metadata follow-up

- continue [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/payan/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md)
- refine PDF content and legal snapshot strategy
- revisit license/metaobject design once launch pressure is removed

### Setup and scale work

- deterministic multi-store onboarding
- stronger setup validation
- broader monitoring and alerting
- scale-readiness review

---

## Archived Documents

These remain in the repo for history only and should not be treated as the active roadmap:

- [IMPLEMENTATION_CONTINUATION_PLAN.md](/Users/payan/producer-launchpad-app/IMPLEMENTATION_CONTINUATION_PLAN.md)
- [LICENSE_DELIVERY_AUTOMATION_PLAN.md](/Users/payan/producer-launchpad-app/LICENSE_DELIVERY_AUTOMATION_PLAN.md)
- [RESEND_EMAIL_IMPLEMENTATION_PLAN.md](/Users/payan/producer-launchpad-app/RESEND_EMAIL_IMPLEMENTATION_PLAN.md)
