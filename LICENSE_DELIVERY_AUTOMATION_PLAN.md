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
Customer views Checkout "Thank You" Page → Native App Block displays Download Button
         ↓
Customer clicks Download → Portal securely streams audio and dynamically generates the PDF License using @react-pdf/renderer based on the linked Metaobject.
```

---

## 1. Why this Architecture?

1. **Unified Delivery:** Customers get both their audio files (WAV/Trackouts) and their legal License Agreement in one place.
2. **Zero Setup for Producers:** Instead of forcing producers to build and upload "fillable PDFs", your app provides 3 professionally designed, built-in React templates. Producers just fill out a simple UI form in the app to set their terms (e.g., "5,000 streams limit").
3. **Data Integrity:** Because the Variant *is* the License (linked via a Custom Metafield to a License Metaobject), generating the exact right contract is mathematically exact. We just pull the variant name and read the linked metaobject data.

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
Triggered instantly on purchase. Creates the token, saves it to the order.

**File:** `app/routes/webhooks.orders-create.tsx`
```typescript
import { createDeliveryToken } from '~/services/secure-delivery.server';

// 1. Order received.
// 2. Generate secure token for the order in the DB.
const delivery = await createDeliveryToken(shop, order.id, order.email);

// 3. Construct the portal URL (e.g., app.com/api/downloads/1abc2def)
const portalUrl = `https://${process.env.APP_URL}/api/downloads/${delivery.secureToken}`;

// 4. Save portalUrl to the Shopify Order Metafield via GraphQL.
// Merchants can now add {{ order.metafields.producer_launchpad.download_url }} to their native Shopify emails!
```

---

## Phase 4: Download Portal & App Block (8 hours)

### 4.1 The Public Download Portal Route
A Remix route that authenticates via the token in the URL.

**File:** `app/routes/api.downloads.$token.tsx`
*   Validates the token.
*   Fetches the order via Shopify Admin API (using offline session for that shop).
*   Lists all purchased line items.
*   **"Download Audio" Button:** Streams the audio files linked in the variant's `custom.license_files_*` metafield.
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
  useApi
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <DownloadBlock />
);

function DownloadBlock() {
  const { order, query } = useApi();
  
  // 1. The Block queries the Shopify Storefront API for the Order Metafield we saved in Phase 3.
  // 2. Extracts the `download_url`.
  
  return (
    <BlockStack>
      <Text size="large">Your Beats are Ready!</Text>
      <Text>Download your high-quality audio files and customized license agreements instantly.</Text>
      <Button to={downloadUrl}>Access Download Portal</Button>
    </BlockStack>
  );
}
```

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
- [ ] Webhook successfully generates secure token and updates Order Metafield.
- [ ] Native App Block displays on Checkout Success page.
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
