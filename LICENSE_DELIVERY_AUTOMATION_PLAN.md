# License Delivery Automation — Implementation Plan

## Overview

Automatically deliver the correct purchased beat files to the customer immediately after purchase, using Shopify-native purchase identity and Prisma-backed delivery state.

Current scope is intentionally focused on:

- identifying which beat the customer bought
- identifying which license package for that specific beat they bought
- resolving the correct files from Prisma
- exposing a secure download portal and checkout success flow

PDF/legal document generation and license metaobject/template design are explicitly deferred to the follow-up document.

## Current Architecture Direction

```text
Producer uploads beat and assigns files to each Shopify variant/license option
        ↓
App creates Shopify product + variants
        ↓
App stores beat files and variant-based delivery mappings in Prisma
        ↓
Customer purchases a product variant
        ↓
orders/create webhook stores Order + OrderItems + delivery token in Prisma
        ↓
Checkout Thank You block polls app backend for portal readiness
        ↓
Customer opens tokenized download portal
        ↓
Portal resolves purchased files from Prisma using the purchased variantId
```

## Core Decisions

### 1. Delivery identity

For runtime delivery, the canonical purchase identity is:

- `productId` = which beat/product was purchased
- `variantId` = which license package for that beat was purchased

This avoids mixing up reused license options across different beats.

### 2. Role of Shopify metafields/metaobjects

Shopify product and variant metafields are configuration metadata, not the runtime delivery source of truth.

Use them for:

- merchant-facing setup
- storefront display
- license labeling
- future legal/PDF metadata

Do not depend on them as the primary runtime delivery resolver once the order has been created.

### 3. Role of Prisma

Prisma should be the primary source of truth for:

- uploaded beat files
- file-to-variant delivery mappings
- orders and order items
- secure delivery tokens
- portal lookup state

### 4. Scope boundary

This plan covers delivery flow only.

Deferred:

- legal/PDF accuracy
- long-term license metaobject schema design
- contract snapshot strategy

Reference: [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/winter/repos/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md)

---

## Why This Architecture

1. Shopify already tells us exactly what was purchased through the order line item `productId` and `variantId`.
2. `variantId` is unique to the specific beat’s license option, so it is safer than relying on reused license references or variant titles.
3. Prisma can resolve downloads deterministically without needing to re-interpret storefront metadata at delivery time.
4. Checkout rendering is more reliable when the extension asks the app backend for current portal status instead of depending on metafield propagation.

---

## Runtime Flow

### 1. Upload / Product Creation Flow

- Merchant uploads files for a beat.
- Merchant assigns files to the specific license variants being sold.
- App creates the Shopify product and its variants.
- App stores uploaded files in Prisma.
- App stores delivery mappings in Prisma keyed by the real Shopify `variantId`.

### 2. Purchase / Webhook Flow

- Customer purchases a beat variant.
- Shopify sends `orders/create`.
- Webhook creates a secure delivery token.
- Webhook stores:
  - `Order`
  - `OrderItem`
  - purchased `productId`
  - purchased `variantId`
  - display-friendly `licenseName` for UI only

### 3. Checkout Success Flow

- Thank You block reads current order context.
- Extension calls backend with authenticated checkout session token.
- Backend looks up the order in Prisma.
- Backend returns `loading`, `ready`, or `failed`.
- Extension renders the appropriate state and portal link when ready.

### 4. Portal Delivery Flow

- Customer opens tokenized portal URL.
- Portal loads order and order items from Prisma.
- For each item, portal resolves files by purchased `variantId`.
- Portal renders the files and any preview/support UI.

---

## Data Model Direction

### Current required concepts

- `BeatFile`
  - one row per uploaded asset
- delivery mapping table
  - should map purchasable `variantId` to one or more `BeatFile` rows
- `Order`
  - one row per purchased order that has downloadable items
- `OrderItem`
  - one row per purchased downloadable line item
  - must include `productId` and `variantId`

### Important note

Older logic used `beatId + licenseTier` or display text such as `licenseName`.

That is now considered legacy/fallback behavior only.

Target state is:

- delivery lookup by `variantId`
- `licenseName` only for display
- optional `licenseTier` only as secondary metadata if useful for reporting/normalization

---

## Implementation Priorities

### Phase 1: Variant-Based Entitlement Resolution

- [x] Refactor Prisma delivery mappings so the primary key is `variantId`, not `licenseName` or `license_id`.
- [x] Keep `productId` on order items for beat identity and debugging.
- [x] Keep `licenseName` only for display and legacy compatibility.
- [x] Add legacy fallback behavior only where necessary during migration.

### Phase 2: Order Persistence and Portal Readiness

- [x] Ensure `orders/create` persists `Order` and `OrderItem` rows idempotently.
- [x] Ensure each order item includes the purchased `variantId`.
- [x] Generate and store a secure download token on order creation.
- [x] Return portal readiness from Prisma-backed state only.

### Phase 3: Checkout Thank You Delivery Flow

- [x] Keep the current extension architecture: order confirmation context -> authenticated backend lookup -> polling until ready.
- [x] Require exact order identifiers on backend lookup rather than loose matching.
- [x] Keep Shopify order metafield mirroring optional for admin/debug/email use only.
- [x] Remove any delivery-critical dependency on order metafield propagation.

### Phase 4: Portal Resolution and File Delivery

- [x] Resolve purchased files by `variantId`.
- [x] Keep preview files at the beat/product level where appropriate.
- [ ] Improve portal handling for missing mappings or partial mappings.
- [x] Decide later whether file URLs should remain direct or move to signed/proxied delivery.

Current note:

- delivery now uses token-protected app proxy routes for private managed R2 files instead of exposing raw storage URLs to the browser

### Phase 5: Legacy Migration and Backward Compatibility

- [ ] Add migration logic for older records that still depend on `beatId + licenseTier` or `licenseName`.
- [ ] Keep a temporary fallback path for legacy orders/products.
- [ ] Add clear markers in code separating stable path vs legacy compatibility path.

---

## Production Readiness Roadmap

### Phase 6: Checkout Delivery Productionization

- [ ] Replace the merchant-facing `app_url` checkout block setting with a stable production app domain or non-merchant-managed configuration.
- [ ] Remove dev tunnel assumptions from the checkout extension flow.
- [ ] Verify checkout delivery on a stable hosted domain.
- [ ] Confirm polling and webhook timing under real production conditions.

### Phase 7: Data Ownership Cleanup

- [ ] Treat Prisma as the sole runtime source of truth for beats, files, mappings, orders, and delivery tokens.
- [ ] Limit Shopify product/variant metafields to setup/bootstrap/display roles.
- [ ] Audit and remove remaining delivery-critical dependence on Shopify metafields.
- [ ] Decide which Shopify metafields remain useful for merchant setup only.

### Phase 8: Reliability and Operations

- [ ] Keep webhook processing idempotent and retry-safe.
- [ ] Add structured logging for webhook processing, checkout delivery lookup, and portal access.
- [ ] Add monitoring/alerting for failed portal creation and unresolved file mappings.
- [ ] Add token expiration, regeneration, and recovery workflows.
- [ ] Add abuse protection/rate limiting for public token-based endpoints.
- [x] Add file download logging that proves which downloadable files were accessed and when.
- [ ] Add a customer recovery path so buyers can regain portal access after leaving checkout.
- [ ] Add email delivery as a second delivery channel using the same secure portal link/token flow.

### Phase 9: UX and Failure Handling

- [ ] Refine checkout block states for loading, ready, delayed, and failed.
- [ ] Improve portal messaging for partial success or unresolved mappings.
- [ ] Add merchant/admin recovery paths for orders that exist but have broken file mappings.
- [ ] Add customer-facing support fallback copy for delayed or failed delivery.
- [x] Remove merchant app shell/navigation from the public tokenized portal.

### Phase 10: Multi-Store Onboarding

- [ ] Make install/setup deterministic for new client stores.
- [ ] Auto-create required metafield definitions, metaobjects, and extension prerequisites during setup.
- [ ] Add a setup status screen that blocks upload/delivery until configuration is complete.
- [ ] Validate missing storage, missing mappings, and missing extension configuration before merchants can ship products.
- [ ] Add merchant control to enable or disable supported license variants per store or per product.
- [ ] Require prices and file mappings only for enabled variants.
- [ ] Ensure disabled variants are not created in Shopify and are ignored by delivery validation logic.

### Phase 11: Scale Release Preparation

- [ ] Test across multiple stores and store configurations.
- [ ] Verify extension behavior under real production timing and webhook delay conditions.
- [ ] Review security, support, and operational handling before broad rollout.
- [ ] Prepare for public app scale requirements if distributing broadly.

---

## Test Checklist

- [ ] Upload a beat and create Shopify variants successfully.
- [ ] Persist Prisma delivery mappings for the created `variantId`s.
- [ ] Place a test order for a specific variant.
- [ ] Confirm webhook stores order, order items, token, `productId`, and `variantId`.
- [ ] Confirm checkout block resolves backend delivery state correctly.
- [ ] Confirm portal loads correctly with token.
- [ ] Confirm files shown in the portal match the purchased `variantId`.
- [ ] Confirm secure file proxy delivery works for private managed R2 objects.
- [ ] Confirm merchant can copy the current portal link from the Deliveries page.
- [ ] Confirm merchant can regenerate a portal link and invalidate the old token.
- [ ] Confirm purchased file downloads increment tracked download counts.
- [ ] Confirm customer can regain access after leaving checkout via the intended recovery path.
- [ ] Confirm legacy fallback behavior still works for any pre-existing mapped products/orders.

---

## Known Deferred Work

- PDF generation accuracy
- purchase-time legal snapshot strategy
- merchant-editable legal/license schema
- long-term license metaobject/template structure

See: [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/winter/repos/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md)

---

## Work On Next

- After delivery flow and entitlement resolution are stable, continue with PDF generation and license metaobject/legal template design using [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/winter/repos/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md).
