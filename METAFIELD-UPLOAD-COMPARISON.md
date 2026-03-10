# Metafield Upload Comparison
**Original Beat Uploader vs. New Producer Launchpad App**

---

## Problem Statement

The new Producer Launchpad app is NOT successfully uploading metafields to Shopify products. Only the `title` field works, and `bpm`/`key` are ending up in the product description instead of as metafields.

---

## Original Beat Uploader (Working) ✅

### Tech Stack
- **Electron Desktop App**
- **REST API** (`/admin/api/{version}/products.json`)
- **Node.js with axios**

### Upload Flow

#### 1. Prepare Product Data (WITHOUT metafields)
```javascript
const productData = {
  product: {
    title: metadata.title,
    body_html: metadata.description || "",
    vendor: metadata.vendor || "Beat Store",
    product_type: "Beat",
    tags: metadata.tags || [],
    variants: shopifyVariants.map(variant => ({
      option1: variant.title,
      price: parseFloat(variant.price).toFixed(2),
      requires_shipping: false,
      taxable: true,
      inventory_management: null
      // NO metafields here!
    })),
    options: [{
      name: "License",
      values: shopifyVariants.map(v => v.title)
    }]
    // Metafields intentionally excluded from initial creation
  }
};
```

#### 2. Create Product via REST API
```javascript
const response = await axios.post(
  `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
  productData,
  {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    }
  }
);

const productId = response.data.product.id;
```

#### 3. Add Product Metafields SEPARATELY (One by One)
```javascript
// productMetafields array prepared earlier:
const productMetafields = [
  {
    namespace: "custom",
    key: "bpm",
    value: "140",
    type: "number_integer"
  },
  {
    namespace: "custom",
    key: "key",
    value: "G minor",
    type: "single_line_text_field"
  },
  {
    namespace: "custom",
    key: "beat_licenses",
    value: JSON.stringify(['gid://shopify/Metaobject/123', 'gid://shopify/Metaobject/456']),
    type: "list.metaobject_reference"
  }
  // ... more metafields
];

for (const metafield of productMetafields) {
  await axios.post(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}/metafields.json`,
    {
      metafield: {
        namespace: metafield.namespace,
        key: metafield.key,
        value: metafield.value,
        type: metafield.type
      }
    },
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  );
}
```

#### 4. Add Variant Metafields SEPARATELY (One by One)
```javascript
for (let i = 0; i < shopifyVariants.length; i++) {
  const variantData = shopifyVariants[i];
  const createdVariant = createProductResponse.variants[i];
  
  for (const metafield of variantData.metafields) {
    await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${createdVariant.id}/metafields.json`,
      {
        metafield: {
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

### Key Patterns from Original App

#### Product Metafield Example
```javascript
{
  namespace: "custom",
  key: "bpm",
  value: "140",
  type: "number_integer"
}
```

#### Metaobject Reference Example
```javascript
{
  namespace: "custom",
  key: "beat_licenses",
  value: JSON.stringify([
    'gid://shopify/Metaobject/123',
    'gid://shopify/Metaobject/456'
  ]),
  type: "list.metaobject_reference"
}
```

#### Variant Metafield Example
```javascript
{
  namespace: "custom",
  key: "license_reference",
  value: "gid://shopify/Metaobject/123",
  type: "metaobject_reference"
}
```

---

## New Producer Launchpad App (NOT Working) ❌

### Tech Stack
- **Remix.run Web App**
- **GraphQL Admin API** (via Shopify App Bridge)
- **TypeScript**

### Current Upload Flow

#### 1. Prepare Product Data in `productCreator.ts`
```typescript
const productMetafields = [
  {
    namespace: "custom",
    key: "bpm",
    value: String(data.bpm),
    type: "number_integer",
  },
  {
    namespace: "custom",
    key: "key",
    value: data.key,
    type: "single_line_text_field",
  },
  // ... more metafields
];
```

#### 2. Call `createProduct()` in `shopify.ts`
```typescript
const product = await this.client.createProduct({
  title: data.title,
  descriptionHtml: data.descriptionHtml || `<p>${data.title} - ${data.bpm} BPM ${data.key}</p>`,
  vendor: data.producerNames[0] || "Unknown Producer",
  productType: "Beat",
  tags: data.tags || ["beat", "instrumental"],
  variants,
});
```

**⚠️ PROBLEM:** Metafields are NOT passed to `createProduct()`!

#### 3. GraphQL Mutation in `shopify.ts`
```typescript
async createProduct(input: {
  title: string;
  descriptionHtml?: string;
  variants: Array<{...}>;
  metafields?: Array<{...}>; // ← Field exists in TypeScript interface
}) {
  const { variants, ...baseInput } = input;
  
  // ❌ ISSUE: metafields are in baseInput but never added to createInput!
  const createInput: Record<string, unknown> = { ...baseInput };
  
  const mutation = `
    mutation CreateProduct($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  // ❌ createInput passed here WITHOUT metafields
  const response = await this.query(mutation, { input: createInput });
}
```

#### 4. Attempt to Add Metafields AFTER Creation
```typescript
// In productCreator.ts:
const metafieldsToSet = productMetafields.map((mf) => ({
  ownerId: product.id,
  namespace: mf.namespace,
  key: mf.key,
  type: mf.type,
  value: mf.value,
}));

await this.client.setMetafields(metafieldsToSet);
```

#### 5. `setMetafields()` GraphQL Mutation
```typescript
async setMetafields(metafields: Array<{...}>) {
  const mutation = `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;
  
  const response = await this.query(mutation, { metafields });
  
  // Check for errors...
}
```

---

## Root Cause Analysis

### Why Metafields Aren't Being Set

| Step | What Should Happen | What Actually Happens | Impact |
|------|-------------------|----------------------|--------|
| 1. Prepare metafields | Build array in `productCreator.ts` | ✅ Working | Metafields array is correct |
| 2. Pass to `createProduct()` | Include metafields in input | ❌ **NOT PASSED** | Metafields never reach GraphQL |
| 3. GraphQL mutation | Include metafields in `ProductInput` | ❌ **EXCLUDED** | Shopify never receives metafields |
| 4. Call `setMetafields()` | Add metafields after creation | ⚠️ **Unclear if this runs** | Fallback may not execute |

### Key Issues

1. **`createProduct()` doesn't receive metafields**
   - Line 303 in `app.beats.new.tsx` doesn't pass metafields to the function
   
2. **GraphQL mutation doesn't include metafields**
   - Even if passed, `createInput` in `shopify.ts` strips them out
   
3. **Variant metafields may work, product metafields don't**
   - Variant metafields use `setMetafields()` after creation
   - Product metafields are never set

---

## Fix Strategy

### Option 1: Follow Original Pattern (REST API)
**Pros:**
- Proven to work
- Matches original beat-uploader exactly

**Cons:**
- Requires switching from GraphQL to REST
- More verbose (separate POST for each metafield)
- Shopify recommends GraphQL for new apps

### Option 2: Fix GraphQL Implementation ✅ **RECOMMENDED**
**Pros:**
- Stays consistent with Remix/Shopify App architecture
- Uses modern GraphQL approach
- Batch operations possible

**Cons:**
- Requires understanding GraphQL ProductInput schema
- May need to debug metafield validation

---

## Fix Implementation (Option 2)

### Step 0: Remove `cover_art` Metafield (Use Product Images Instead)

**Background:** The original beat-uploader uses `images: [{ src: url }]` for cover art, not a metafield.

**Current bug:** New app defines `custom.cover_art` metafield but should use product images array.

**Fix:**
1. Remove `cover_art` from `REQUIRED_PRODUCT_METAFIELDS` in `metafieldSetup.ts`
2. Remove metafield push for `cover_art` in `productCreator.ts`
3. Add `images` parameter to `createProduct()` interface in `shopify.ts`
4. Pass `images: [{ src: coverArtUrl }]` when creating product

**Example:**
```typescript
// In productCreator.ts:
const product = await this.client.createProduct({
  title: data.title,
  // ... other fields
  images: data.coverArtUrl ? [{ src: data.coverArtUrl }] : [],
  metafields: productMetafields, // NO cover_art in here
});
```

---

### Step 1: Pass Metafields to `createProduct()`

**File:** `app/services/productCreator.ts` (line ~155)

**Current:**
```typescript
const product = await this.client.createProduct({
  title: data.title,
  descriptionHtml: data.descriptionHtml || `<p>${data.title} - ${data.bpm} BPM ${data.key}</p>`,
  vendor: data.producerNames[0] || "Unknown Producer",
  productType: "Beat",
  tags: data.tags || ["beat", "instrumental"],
  variants,
});
```

**Fixed:**
```typescript
const product = await this.client.createProduct({
  title: data.title,
  descriptionHtml: data.descriptionHtml || `<p>${data.title} - ${data.bpm} BPM ${data.key}</p>`,
  vendor: data.producerNames[0] || "Unknown Producer",
  productType: "Beat",
  tags: data.tags || ["beat", "instrumental"],
  variants,
  metafields: productMetafields, // ← ADD THIS
});
```

### Step 2: Include Metafields in GraphQL Mutation

**File:** `app/services/shopify.ts` (line ~451)

**Current:**
```typescript
const { variants, ...baseInput } = input;
const createInput: Record<string, unknown> = { ...baseInput };

if (optionValues.length > 0) {
  createInput.productOptions = [
    {
      name: "License",
      values: optionValues.map((name) => ({ name })),
    },
  ];
}
```

**Fixed:**
```typescript
const { variants, metafields, ...baseInput } = input;
const createInput: Record<string, unknown> = { ...baseInput };

if (optionValues.length > 0) {
  createInput.productOptions = [
    {
      name: "License",
      values: optionValues.map((name) => ({ name })),
    },
  ];
}

// Add metafields if provided
if (metafields && metafields.length > 0) {
  createInput.metafields = metafields.map(mf => ({
    namespace: mf.namespace,
    key: mf.key,
    value: mf.value,
    type: mf.type,
  }));
}
```

### Step 3: Update GraphQL Mutation to Include Metafields

**File:** `app/services/shopify.ts` (line ~503)

The mutation already supports metafields in `ProductInput`, but we need to make sure it's being passed correctly.

**Current mutation is OK** — GraphQL `ProductInput` type accepts metafields. The issue is that we're not passing them in `createInput`.

---

## Verification Steps

After applying fixes:

1. **Upload a test beat** with:
   - BPM: 140
   - Key: G minor
   - Genre: Trap
   - Producer: Test Producer
   - 3 license tiers

2. **Check Shopify Admin** → Products → {New Beat}:
   - **Product Images section:**
     - ✅ Cover art should appear as main product image
   - **Metafields section:**
     - ✅ `custom.bpm` = 140 (number_integer)
     - ✅ `custom.key` = "G minor" (single_line_text_field)
     - ✅ `custom.genre` = JSON array of genre GIDs
     - ✅ `custom.produced_by` = JSON array of producer GIDs
     - ✅ `custom.beat_licenses` = JSON array of license GIDs
     - ✅ `custom.audio_preview` = URL
     - ❌ `custom.cover_art` should NOT exist (removed)
     - ✅ `custom.license_files_basic` = JSON file array
     - ✅ `custom.license_files_premium` = JSON file array
     - ✅ `custom.license_files_unlimited` = JSON file array

3. **Check each variant**:
   - Verify `custom.license_reference` = correct license GID

4. **Test in storefront** (if theme uses metafields):
   - BPM displays correctly
   - Key displays correctly
   - Genre tags work
   - License files download correctly

---

## Tech Stack Impact

| Feature | Original (REST) | New (GraphQL) | Notes |
|---------|----------------|---------------|-------|
| **Product creation** | `POST /products.json` | `productCreate` mutation | GraphQL more concise |
| **Metafield creation** | `POST /products/{id}/metafields.json` | `metafieldsSet` mutation | GraphQL can batch |
| **Variant metafields** | `POST /variants/{id}/metafields.json` | `metafieldsSet` mutation | Same approach |
| **Error handling** | HTTP status codes | `userErrors` array | GraphQL more detailed |
| **Batching** | Not supported (loop) | Supported (single call) | GraphQL advantage |

---

## Summary

**Problem:** Metafields aren't being passed to the GraphQL `productCreate` mutation.

**Root cause:** 
1. `productMetafields` array is built but never passed to `createProduct()`
2. Even if passed, `shopify.ts` strips metafields from `createInput`

**Solution:**
1. Pass `metafields: productMetafields` in `createProduct()` call
2. Extract metafields from input and add to `createInput` before GraphQL mutation
3. Verify metafields appear in Shopify Admin after upload

**Files to modify:**
- `app/services/productCreator.ts` (line ~155)
- `app/services/shopify.ts` (line ~451)
