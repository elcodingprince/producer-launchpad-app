# Producer Launchpad Delivery Implementation Continuation Plan

## Purpose

This document is the current implementation handoff for the delivery flow. It is written so work can continue from a fresh thread without re-deriving the architecture.

It focuses on:

- Shopify product upload behavior
- variant-based entitlement resolution
- order webhook persistence
- checkout thank-you block behavior
- tokenized download portal flow
- secure file delivery through the app
- portal re-entry and delivery recovery strategy

It does not focus on final PDF/legal template design. That work is tracked separately in [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/payan/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md).

Email implementation details are tracked separately in [RESEND_EMAIL_IMPLEMENTATION_PLAN.md](/Users/payan/producer-launchpad-app/RESEND_EMAIL_IMPLEMENTATION_PLAN.md).

---

## Current Product Direction

### Core runtime rule

For delivery, the canonical purchase identity is:

- `productId` = which beat was purchased
- `variantId` = which license package for that beat was purchased

Do not rely on:

- variant display text
- license display names
- shared license metaobject reuse

for runtime file entitlement decisions.

### Why

Many beats reuse the same license options. The same license metaobject can be attached to multiple products. That means the only safe runtime way to know which package was bought is the Shopify order line item’s `variantId`.

### Role separation

- Shopify product/variant metafields and metaobjects:
  - setup metadata
  - storefront display metadata
  - future PDF/legal metadata
- Prisma:
  - runtime delivery source of truth
  - file mappings
  - orders
  - order items
  - secure tokens

---

## What Has Been Implemented

### 1. Prisma delivery mappings were moved to `variantId`

Current schema direction:

- `BeatFile` stores uploaded assets
- `LicenseFileMapping` stores:
  - `variantId`
  - `fileId`
  - `sortOrder`
- `OrderItem` stores:
  - `productId`
  - `variantId`
  - `licenseName` for display only

Migration added:

- [prisma/migrations/20260313113000_refactor_delivery_mappings_to_variant_id/migration.sql](/Users/winter/repos/producer-launchpad-app/prisma/migrations/20260313113000_refactor_delivery_mappings_to_variant_id/migration.sql)

### 2. Upload flow now persists mappings against created Shopify variant IDs

The upload route now:

- creates the product
- reads the returned Shopify variants
- maps each license tier selection to the real created `variantId`
- stores `LicenseFileMapping.variantId` rows in Prisma

Key file:

- [app/routes/app.beats.new.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/app.beats.new.tsx)

### 3. Webhook persistence uses Shopify-native purchase identity

The order webhook persists:

- `Order`
- `OrderItem`
- `productId`
- `variantId`
- `licenseName`
- `downloadToken`

Key file:

- [app/routes/webhooks.orders-create.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/webhooks.orders-create.tsx)

### 4. Portal resolution now uses `variantId`

The tokenized download portal resolves files by:

- loading the order from Prisma by `downloadToken`
- reading each `OrderItem.variantId`
- loading matching `LicenseFileMapping` rows by normalized `variantId`
- tolerating both numeric Shopify IDs and legacy GraphQL GID-style IDs during lookup

Key file:

- [app/routes/downloads.$token.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/downloads.$token.tsx)

### 5. Checkout block status lookup now keys off Shopify order ID

The thank-you block asks the app backend for portal readiness.

The backend now resolves the order by:

- authenticated checkout session
- normalized Shopify `orderId`
- shop domain from session token

and no longer requires the checkout confirmation code / display number to match `Order.orderNumber`.

Key file:

- [app/routes/api.checkout.delivery-status.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/api.checkout.delivery-status.tsx)

### 6. Public portal access and secure file delivery now work end to end

Current behavior:

- checkout block opens the tokenized portal successfully
- portal preview audio loads through the app
- purchased MP3 files download through the app
- private managed R2 objects are no longer exposed directly to the browser
- successful purchased-file downloads now increment tracked delivery counts

Important implementation detail:

- the app now proxies/token-authorizes file delivery instead of linking buyers to raw `r2.cloudflarestorage.com` object URLs
- purchased file authorization remains variant-based
- preview authorization remains product-level

Key files:

- [app/routes/api.files.$token.$fileId.tsx](/Users/payan/producer-launchpad-app/app/routes/api.files.$token.$fileId.tsx)
- [app/services/r2.server.ts](/Users/payan/producer-launchpad-app/app/services/r2.server.ts)
- [app/routes/downloads.$token.tsx](/Users/payan/producer-launchpad-app/app/routes/downloads.$token.tsx)

### 7. New uploads are now publishing to the live store

Current behavior:

- upload status is wired through product creation
- active products attempt Online Store publication automatically
- newly uploaded products have been verified to appear live on the storefront

Key files:

- [app/routes/app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx)
- [app/services/productCreator.ts](/Users/payan/producer-launchpad-app/app/services/productCreator.ts)
- [app/services/shopify.ts](/Users/payan/producer-launchpad-app/app/services/shopify.ts)
- [app/shopify.server.ts](/Users/payan/producer-launchpad-app/app/shopify.server.ts)

### 8. Merchant recovery tooling now exists in the embedded app

Current behavior:

- merchants can open a Deliveries screen inside the embedded app
- merchants can copy the current portal link for an order
- merchants can regenerate the access token for an order
- regenerating a token invalidates the previous portal link immediately

Key files:

- [app/routes/app.deliveries.tsx](/Users/payan/producer-launchpad-app/app/routes/app.deliveries.tsx)
- [app/root.tsx](/Users/payan/producer-launchpad-app/app/root.tsx)

---

## What Has Been Verified

### Variant-based Prisma mapping

Fresh upload verification already showed:

- `BeatFile` rows created correctly
- `LicenseFileMapping` rows created correctly
- `LicenseFileMapping.variantId` populated
- different variants can map to different file sets

Known example:

- Basic -> MP3
- Unlimited -> MP3 + STEMS ZIP

This confirmed the Phase 1 data model change worked.

### Checkout + portal delivery flow

End-to-end verification now shows:

- checkout block reaches ready state
- checkout button opens the tokenized portal
- portal renders the purchased item
- preview audio streams correctly
- purchased MP3 downloads successfully
- generated license PDF downloads successfully
- merchant recovery via copied/regenerated portal links works
- regenerated tokens invalidate the previous portal URL as expected

This confirms the core delivery loop is working for at least one real purchase.

---

## Current Open Bugs / Active Work

### 1. Portal re-entry / customer recovery path

Observed behavior:

- the checkout block gives an instant post-purchase path into the portal
- merchant-side recovery now exists through the Deliveries page
- but there is still no durable app-owned customer recovery channel yet

Current product direction:

- keep the checkout block for instant access
- keep merchant-side recovery inside the app
- also add email delivery so buyers can return later
- treat checkout block and email as complementary, not either/or

Needed work:

- implement the app-owned delivery email system described in [RESEND_EMAIL_IMPLEMENTATION_PLAN.md](/Users/payan/producer-launchpad-app/RESEND_EMAIL_IMPLEMENTATION_PLAN.md)

### 2. Portal failure states are still too thin

Observed behavior:

- several delivery failures were only diagnosable by inspecting Prisma or raw browser errors

Needed work:

- add clearer customer-facing messages for:
  - missing file mappings
  - delayed webhook/order readiness
  - storage delivery failures
- add clearer merchant/admin diagnostics for:
  - variant mismatch
  - missing storage URL
  - authorization failure to storage
  - missing order recovery path

### 3. Token lifecycle remains open

Needed work:

- define whether `downloadToken`s expire
- add token regeneration/reissue flow for support
- decide whether portal access should remain indefinite or time-bounded
- define how customer support should resend access when requested

---

## Immediate Next Phase

## Phase 4: Make Delivery Recoverable and Auditable

### Goal

Keep the instant checkout portal, but make delivery resilient after the customer leaves checkout.

### Tasks

1. Add post-purchase email delivery using the same secure portal token.
2. Keep checkout block delivery as the instant-access path.
3. Add token recovery/regeneration design so customers can regain access later.
4. Improve customer-visible and merchant-visible error states.

---

## Next Delivery Verification Phase

## Phase 5: Delivery Reliability and Operations

### Goal

Make the delivery system supportable and explainable when something breaks.

### Tasks

1. Add structured logs around:
   - order webhook processing
   - checkout delivery status polling
   - portal access
   - secure file download attempts
2. Surface actionable diagnostics for missing mappings or storage failures.
3. Add download auditing that proves whether a customer accessed downloadable files.
4. Revisit rate limiting / abuse protection later once recovery and logging are stable.

1. Place a test order for a known variant.
2. Confirm webhook creates:
   - `Order`
   - `OrderItem`
   - `downloadToken`
3. Confirm checkout block reaches `ready`.
4. Confirm button opens the tokenized portal.
5. Confirm portal file set matches purchased `variantId`.

### Desired proof

- Basic purchase should resolve only the Basic-mapped files
- Unlimited purchase should resolve the Unlimited-mapped files, including ZIP/stems when assigned

---

## Remaining Planned Phases

## Phase 4: Portal Hardening

- add better missing-file / partial-mapping messaging
- decide whether raw storage URLs are acceptable or whether signed/proxied delivery is needed
- add logging around portal access and file resolution

## Phase 5: Checkout Delivery Productionization

- replace merchant-facing temporary `app_url` assumptions with stable production app origin
- verify thank-you block behavior under production timing and webhook lag
- remove any remaining dev tunnel assumptions

## Phase 6: Variant Configuration Flexibility

- allow merchants to enable or disable license variants
- require prices and file mappings only for enabled variants
- prevent disabled variants from being created in Shopify
- ensure delivery logic ignores disabled variants entirely

This was intentionally deferred so it does not complicate the core delivery refactor.

## Phase 7: Reliability / Ops

- webhook idempotency review
- token expiration and recovery path
- rate limiting for token endpoints
- structured logs for upload, webhook, checkout lookup, and portal access

## Phase 8: PDF / Legal Follow-Up

Deferred to:

- [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/winter/repos/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md)

This future work should use purchase-time snapshots for legal accuracy, but it is not the current implementation focus.

---

## Key Files To Understand First

If starting fresh, read these in order:

1. [LICENSE_DELIVERY_AUTOMATION_PLAN.md](/Users/winter/repos/producer-launchpad-app/LICENSE_DELIVERY_AUTOMATION_PLAN.md)
2. [IMPLEMENTATION_CONTINUATION_PLAN.md](/Users/winter/repos/producer-launchpad-app/IMPLEMENTATION_CONTINUATION_PLAN.md)
3. [app/routes/app.beats.new.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/app.beats.new.tsx)
4. [app/services/productCreator.ts](/Users/winter/repos/producer-launchpad-app/app/services/productCreator.ts)
5. [app/services/shopify.ts](/Users/winter/repos/producer-launchpad-app/app/services/shopify.ts)
6. [app/routes/webhooks.orders-create.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/webhooks.orders-create.tsx)
7. [app/routes/api.checkout.delivery-status.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/api.checkout.delivery-status.tsx)
8. [extensions/download-portal-block/src/ThankYouBlock.tsx](/Users/winter/repos/producer-launchpad-app/extensions/download-portal-block/src/ThankYouBlock.tsx)
9. [app/routes/downloads.$token.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/downloads.$token.tsx)

---

## Short Summary

Current implementation direction is:

- upload creates Shopify product + variants
- Prisma stores file mappings by `variantId`
- webhook stores purchased `variantId`
- checkout block resolves portal by Shopify `orderId`
- portal resolves downloadable files by purchased `variantId`

That is the core system being built and stabilized.
