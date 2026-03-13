# License Delivery Automation — Implementation Plan

## Overview

Automatically generate and deliver customized license PDFs and high-quality audio files (the "License Package") to customers immediately upon purchase.

**Architecture (SaaS Model for Producers):**
```
Producer configures License Metaobjects in the App (Prices, Terms, Template Choice)
         ↓
Upload beat → App creates Variants (named after Licenses) and links License Metaobject
         ↓
Customer purchases a Beat (Variant) → Webhook generates secure Download Portal link
         ↓
Customer views Checkout "Thank You" Page → Native App Block asks app backend for portal status by order ID
         ↓
Customer clicks Download → Portal securely streams audio and dynamically generates the PDF License using @react-pdf/renderer based on the linked Metaobject.
```

---

## 1. Why this Architecture?

1. **Unified Delivery:** Customers get both their audio files (WAV/Trackouts) and their legal License Agreement in one place.
2. **Zero Setup for Producers:** Instead of forcing producers to build and upload "fillable PDFs", your app provides 3 professionally designed, built-in React templates. Producers just fill out a simple UI form in the app to set their terms (e.g., "5,000 streams limit").
3. **Data Integrity:** Because the Variant *is* the License (linked via a Custom Metafield to a License Metaobject), generating the exact right contract is mathematically exact. The webhook resolves the purchased variant into a stable backend delivery record, and the Thank You block only displays the resulting portal state.

---

## File Structure

```
app/
├── routes/
│   ├── app.licenses._index.tsx          # Manage License settings & terms
│   ├── webhooks.orders-create.tsx       # Generates secure portal link & metafields
│   ├── app.upload.tsx                   # Upload process (links variant to Metaobject)
│   └── api.downloads.$token.tsx         # The secure public Download Portal for customers
├── services/
│   ├── secure-delivery.server.ts        # Manages JWT tokens and access logs
│   ├── metaobject.server.ts             # Reads the License Terms from Shopify
│   └── pdf-generator.server.tsx         # Uses @react-pdf/renderer to build the PDF
├── components/
│   ├── DownloadPortalUi.tsx             # The public-facing download screen
│   └── pdf-templates/                   # The Built-In SaaS Templates
│       ├── MinimalLease.tsx
│       ├── PremiumStandard.tsx
│       └── ExclusiveContract.tsx
└── types/
    └── delivery.ts                      # TypeScript interfaces
extensions/
└── download-portal-block/               # Shopify Checkout UI Extension
    ├── src/
    │   └── ThankYouBlock.tsx            # The "Download Your Beats" button on checkout
    └── shopify.extension.toml
```

---

## Phase 1: Database & Order Tracking (2 hours)

### Prisma Schema Additions

```prisma
// Add to prisma/schema.prisma

model OrderDelivery {
  id              String   @id @default(cuid())
  shopDomain      String
  orderId         String
  secureToken     String   @unique // JWT or random hash for public access
  customerEmail   String
  accessCount     Int      @default(0)
  lastAccessed    DateTime?
  expiresAt       DateTime // e.g., 30 days after purchase
  createdAt       DateTime @default(now())

  @@index([shopDomain, orderId])
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_unified_delivery
```

---

## Phase 2: PDF Generation Service (`@react-pdf/renderer`)

### 2.1 The Built-In Template Component

Your app will ship with beautiful default templates. Here we use React to construct the PDF layout.

**File:** `app/components/pdf-templates/PremiumStandard.tsx`
```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Helvetica' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  section: { margin: 10, padding: 10, fontSize: 12 },
  bold: { fontWeight: 'bold' }
});

export const PremiumStandardTemplate = ({ orderData, licenseTerms }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* License Name comes from the Variant Name bought at checkout */}
      <Text style={styles.header}>{orderData.variantName} Agreement</Text>
      
      <View style={styles.section}>
        <Text>This agreement is made between {orderData.producerName} and <Text style={styles.bold}>{orderData.buyerName}</Text>.</Text>
        <Text>Date: {orderData.orderDate}</Text>
        <Text>Beat Title: <Text style={styles.bold}>{orderData.beatTitle}</Text></Text>
        <Text>Purchase Price: {orderData.price}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.bold}>TERMS AND CONDITIONS</Text>
        {/* Dynamic terms fetched from the linked License Metaobject */}
        <Text>1. The buyer is permitted to distribute up to {licenseTerms.distributionLimit} copies of the derivative work.</Text>
        <Text>2. Audio Streams allowed: {licenseTerms.streamingLimit}.</Text>
        {licenseTerms.allowRadio ? <Text>3. Commercial Radio play is permitted.</Text> : <Text>3. Commercial Radio play is strictly prohibited.</Text>}
      </View>
    </Page>
  </Document>
);
```

### 2.2 The PDF Generator execution

**File:** `app/services/pdf-generator.server.tsx`
```tsx
import { renderToStream } from '@react-pdf/renderer';
import { PremiumStandardTemplate } from '~/components/pdf-templates/PremiumStandard';

export async function generateDynamicPdf(orderData: any, licenseTermsData: any) {
  // We can dynamically select the template based on producer settings later.
  // For now, render the standard template.
  const stream = await renderToStream(
    <PremiumStandardTemplate 
        orderData={orderData} 
        licenseTerms={licenseTermsData} 
    />
  );
  
  return stream;
}
```

---

## Phase 3: Webhook & Order Setup (3 hours)

### 3.1 Order Webhook
Triggered instantly on purchase. Creates the token, saves the order in Prisma, and optionally mirrors the portal URL onto the Shopify order.

**File:** `app/routes/webhooks.orders-create.tsx`
```typescript
import { createDeliveryToken } from '~/services/secure-delivery.server';

// 1. Order received.
// 2. Generate secure token for the order in the DB.
const delivery = await createDeliveryToken(shop, order.id, order.email);

// 3. Construct the portal URL (e.g., app.com/api/downloads/1abc2def)
const portalUrl = `https://${process.env.APP_URL}/api/downloads/${delivery.secureToken}`;

// 4. Persist the resolved delivery state in Prisma.
// 5. Optionally mirror portalUrl to a Shopify Order Metafield for admin visibility / email templates.
// The checkout extension should not depend on this metafield as its primary read path.
```

---

## Phase 4: Download Portal & App Block (8 hours)

### 4.1 The Public Download Portal Route
A Remix route that authenticates via the token in the URL.

**File:** `app/routes/api.downloads.$token.tsx`
*   Validates the token.
*   Fetches the order via Shopify Admin API (using offline session for that shop).
*   Lists all purchased line items.
*   **"Download Audio" Button:** Streams the audio files resolved from Prisma-backed beat/license mappings.
*   **"Download PDF" Button:** Intercepts click -> Queries Shopify GraphQL for the line item's linked `License Metaobject` -> executes `generateDynamicPdf()` -> streams the PDF directly into the browser.

### 4.2 The Shopify App Block (Checkout UI Extension)
A native SaaS extension that appears on the Thank You page for any producer who installs the app.

**Command to scaffold:** `npm run shopify app generate extension` -> Checkout UI -> `purchase.thank-you.block.render`.

**File:** `extensions/download-portal-block/src/ThankYouBlock.tsx`
```tsx
import {
  reactExtension,
  Button,
  BlockStack,
  Text,
  useOrder
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <DownloadBlock />
);

function DownloadBlock() {
  const order = useOrder();
  
  // 1. Read the Shopify order ID from the Thank You page context.
  // 2. Call the app backend for portal readiness / download URL.
  // 3. Render loading, ready, or failed state based on backend response.
  
  return (
    <BlockStack>
      <Text size="large">Your Beats are Ready!</Text>
      <Text>Download your high-quality audio files and customized license agreements instantly.</Text>
      <Button to={downloadUrl}>Access Download Portal</Button>
    </BlockStack>
  );
}
```

### 4.3 Delivery Lookup Endpoint
Add a checkout-safe backend endpoint that returns the portal state for a completed order.

**Example flow:**
- Checkout extension reads `order.id`.
- Extension sends authenticated request to app backend.
- Backend verifies checkout session token.
- Backend looks up Prisma `Order` / `OrderItem` by Shopify order ID.
- Backend returns `{ status, downloadUrl }`.

This avoids relying on Shopify order metafield propagation timing or extension metafield visibility.

---

## Follow-Up Tasks From Implementation

### A. Remove the checkout extension's dependency on Shopify order metafields
- [ ] Replace `useAppMetafields({ namespace: "producer_launchpad", key: "download_url" })` in the Thank You extension with a backend fetch by Shopify order ID.
- [ ] Add a Remix route for checkout extensions that authenticates with `authenticate.public.checkout(request)`.
- [ ] Return delivery states from the backend: `loading`, `ready`, `failed`.
- [ ] Keep the Shopify order metafield mirror optional for merchant email/admin use, not as the extension's primary data source.

### B. Make variant/license resolution resilient to variant title changes
- [ ] Stop using human-readable `licenseName` as the primary lookup key for delivery entitlement.
- [ ] Persist the purchased `variantId` on each order item and resolve files using that stable ID first.
- [ ] Introduce a canonical internal `licenseTier` slug (for example `basic`, `premium`, `unlimited`) where needed instead of relying on variant title text.
- [ ] Keep display labels like "Premium License" for UI only, not matching logic.
- [ ] Add a fallback / migration path for older orders that only have `licenseName`.

### C. Recommended Implementation Order
1. [ ] Update the Thank You block in `extensions/download-portal-block/src/ThankYouBlock.tsx` to read `order.id` via `useOrder()` and fetch delivery status from the app backend.
2. [ ] Add a checkout-safe backend endpoint, for example `app/routes/api.checkout.delivery-status.tsx`, that uses `authenticate.public.checkout(request)` and returns `{ status, downloadUrl }` for a Shopify order ID.
3. [ ] Keep Prisma as the primary delivery source of truth in `app/routes/webhooks.orders-create.tsx`, and treat the Shopify order metafield as optional mirror/debug/email data only.
4. [ ] Refactor delivery entitlement resolution to use `variantId` as the primary key and a canonical `licenseTier` slug as secondary stable metadata where needed.
5. [ ] Keep `licenseName` only as display text and as a legacy fallback for older orders or products that predate the stable matching keys.
6. [ ] Verify end-to-end behavior with a new order and a legacy order: webhook persistence, checkout block state transition, portal contents, and fallback matching.

---

## Production Readiness Roadmap

### Phase 6: Checkout Delivery Productionization
- [ ] Replace the merchant-facing `app_url` checkout block setting with a stable hosted production app domain.
- [ ] Keep the current checkout extension architecture: `orderConfirmation` -> authenticated backend lookup -> polling until ready.
- [ ] Remove any remaining dev-tunnel assumptions from the checkout extension flow.
- [ ] Keep the Shopify order metafield mirror optional, not required for checkout rendering.
- [ ] Verify checkout delivery on a stable production domain instead of a rotating Cloudflare dev tunnel.

### Phase 7: Entitlement Resolution Hardening
- [ ] Refactor download portal file resolution to use `variantId` as the primary entitlement key.
- [ ] Add a canonical internal `licenseTier` slug where useful for normalization and reporting.
- [ ] Keep `licenseName` only for display and legacy fallback.
- [ ] Add migration logic for older orders/products that still depend on `beatId + licenseName`.
- [ ] Add tests for mixed scenarios: current stable mapping and legacy fallback mapping.

### Phase 8: Data Ownership Cleanup
- [ ] Treat Prisma as the sole source of truth for beats, files, license mappings, orders, and delivery tokens.
- [ ] Limit Shopify product/variant metafields to configuration/bootstrap use, not runtime delivery decisions.
- [ ] Audit existing runtime code paths and remove any remaining delivery-critical dependence on Shopify metafields.
- [ ] Decide which Shopify metafields remain necessary for setup UI versus which can be removed entirely.

### Phase 9: Multi-Store Onboarding
- [ ] Make install/setup deterministic for new client stores.
- [ ] Auto-create required metafield definitions, metaobjects, and extension prerequisites during setup.
- [ ] Add a clear setup status screen that blocks upload/delivery flows until configuration is complete.
- [ ] Add validation for missing storage, missing license mappings, and missing extension configuration.
- [ ] Ensure onboarding works without assuming your own theme/store-specific data state.

### Phase 10: Reliability and Operations
- [ ] Keep webhook processing idempotent and retry-safe.
- [ ] Add structured logging for webhook processing, checkout delivery lookup, and portal access.
- [ ] Add monitoring/alerting for failed portal creation and failed download lookups.
- [ ] Add token expiration, regeneration, and support recovery workflows.
- [ ] Add abuse protection/rate limiting for public token-based download endpoints.

### Phase 11: UX and Failure Handling
- [ ] Refine checkout block states for loading, ready, delayed, and failed delivery cases.
- [ ] Improve portal messaging for partial success or unresolved file mappings.
- [ ] Add a merchant/admin-facing recovery path when order delivery exists but files are missing.
- [ ] Add customer-facing support fallback copy for failed or delayed delivery.

### Phase 12: Scale Release Preparation
- [ ] Move to stable production hosting and remove manual infrastructure configuration from merchant-facing block settings.
- [ ] Test across multiple stores and store configurations.
- [ ] Verify checkout extension behavior under real production timing and webhook delay conditions.
- [ ] Prepare for Shopify public app requirements if distributing to many client stores.
- [ ] Review security, data handling, and support processes before broad rollout.

---

## Phase 5: Environment & Testing (2.5 hours)

### Install Dependencies
```bash
npm install @react-pdf/renderer
```

### Test Checklist
- [ ] Configure License Metaobjects in the app UI.
- [ ] Upload beat, mapping variant to License Metaobject.
- [ ] Place test order for particular variant (e.g., "Premium License").
- [ ] Webhook successfully generates secure token and persists order delivery state in Prisma.
- [ ] Optional Shopify Order Metafield mirror is written successfully.
- [ ] Native App Block displays on Checkout Success page and resolves portal status from backend.
- [ ] Download Portal loads correctly with token.
- [ ] PDF generates on-the-fly, pulling the Variant Name as the Title and Metaobject data as the terms.

---

## Timeline Summary

| Phase | Hours | Deliverable |
|-------|-------|-------------|
| Database | 2 | Schema delivery tracking |
| Templates | 6 | Build 3 default React-PDF layouts + logic |
| Webhooks | 3 | Order listening & token creation |
| UI | 8 | Unified portal + Checkout App Block |
| Testing | 2.5 | End-to-end testing |
| **Total** | **21.5 hours** | **3 dev days** |

**Monthly Operational Costs:** $0 (No email API fees, scales perfectly for a distributed SaaS model).
