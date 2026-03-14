# Producer Launchpad Delivery Implementation Continuation Plan

## Purpose

This document is the current implementation handoff for the delivery flow. It is written so work can continue from a fresh thread without re-deriving the architecture.

It focuses on:

- Shopify product upload behavior
- variant-based entitlement resolution
- order webhook persistence
- checkout thank-you block behavior
- tokenized download portal flow

It does not focus on final PDF/legal template design. That work is tracked separately in [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/winter/repos/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md).

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
- loading matching `LicenseFileMapping` rows by `variantId`

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

---

## Current Open Bugs / Active Work

### 1. Checkout button navigation

Observed behavior:

- checkout block reaches ready state
- clicking the button previously did nothing or opened a Shopify CDN 404

Current fix:

- the checkout extension now uses a checkout-safe external link control:
  - `Link href={downloadUrl} target="_blank"`
- the backend now returns an absolute portal URL built from app origin, not a relative path

Files:

- [extensions/download-portal-block/src/ThankYouBlock.tsx](/Users/winter/repos/producer-launchpad-app/extensions/download-portal-block/src/ThankYouBlock.tsx)
- [app/routes/api.checkout.delivery-status.tsx](/Users/winter/repos/producer-launchpad-app/app/routes/api.checkout.delivery-status.tsx)

Status:

- needs re-test after extension bundle refresh / new checkout

### 2. New uploads are not showing on the storefront by default

Observed behavior:

- older `test` product appears in storefront
- newer uploaded products often do not

Two likely causes were identified:

#### 2a. Publishing

Newly uploaded products were observed as:

- `Not included in any sales channels`

If a product is not published to Online Store, it will not appear in the storefront.

#### 2b. Inventory behavior

Newly uploaded variants were observed as:

- `0 available`
- or `0 in stock for 3 variants`

whereas the older working product showed:

- `Inventory is not stocked at Shop location`

This suggests digital variants need explicit non-blocking inventory behavior.

Current partial fix:

- the Shopify variant bulk update path now also carries `inventoryPolicy: "CONTINUE"`

Key file:

- [app/services/shopify.ts](/Users/winter/repos/producer-launchpad-app/app/services/shopify.ts)

Status:

- still needs explicit storefront publication fix
- may still need explicit inventory tracking disable if `CONTINUE` is not sufficient

---

## Immediate Next Phase

## Phase 2: Make Uploaded Products Reliably Buyable and Visible

### Goal

Ensure every newly uploaded product:

- is published to the Online Store
- is purchasable as a digital product
- is not blocked by inventory defaults

### Tasks

1. Inspect Shopify product creation path and publish products to the correct sales channels after creation.
2. Confirm whether publication should happen through:
   - publication API
   - product status + channel availability API
   - theme/storefront defaults already available in this app config
3. Ensure digital license variants are not blocked by inventory:
   - continue selling when out of stock
   - possibly disable tracking if Shopify requires that for digital behavior
4. Upload a fresh product and verify:
   - appears in admin as available to Online Store
   - appears in storefront catalog
   - can be checked out

---

## Next Delivery Verification Phase

## Phase 3: End-to-End Order Delivery Validation

### Goal

Verify the complete flow from purchase to portal resolution.

### Tasks

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
