# Metaobject Reference Guide
**How to Store and Display Metaobject References in Shopify**

---

## Overview

When you create a metaobject (like `producer`, `genre`, or `beat_license`), Shopify assigns it a **Global ID (GID)**. To reference that metaobject from a product or variant metafield, you store the GID as the metafield value.

**Key insight:** The storefront automatically resolves the GID and gives you access to all fields inside the metaobject.

---

## How It Works: Producer Example

### Step 1: Producer Metaobject Exists

**Metaobject Type:** `producer`

**Fields:**
```typescript
{
  name: "John Producer",      // single_line_text_field (required)
  image: <file reference>,    // file_reference (optional)
  bio: "<p>Music producer</p>" // rich_text_field (optional)
}
```

**Shopify assigns GID:**
```
gid://shopify/Metaobject/789
```

---

### Step 2: Product Metafield References Producer

**Metafield Definition:**
```typescript
{
  namespace: "custom",
  key: "produced_by",
  type: "list.metaobject_reference",
  ownerType: "PRODUCT"
}
```

**Metafield Value (stored as JSON string):**
```javascript
// For a single producer:
value: '["gid://shopify/Metaobject/789"]'

// For multiple producers:
value: '["gid://shopify/Metaobject/789", "gid://shopify/Metaobject/790"]'
```

**Important:** The value is a **JSON-stringified array of GIDs**, even for single references.

---

### Step 3: Storefront Accesses Producer Name

**In Liquid (theme):**
```liquid
{% assign producers = product.metafields.custom.produced_by %}

{% for producer in producers %}
  <p>{{ producer.name }}</p>
  <!-- Outputs: "John Producer" -->
{% endfor %}
```

**What's happening:**
- Shopify sees the GID `gid://shopify/Metaobject/789`
- Automatically resolves it to the full producer metaobject
- You can access any field: `.name`, `.image`, `.bio`

**The metafield stores the GID, but the storefront sees the actual metaobject data.**

---

## Code Implementation: How to Build the Metafield Value

### Original Beat Uploader (Working Example)

**From `sectionUtils.js`:**
```javascript
// section.value is an array of GIDs:
// ["gid://shopify/Metaobject/789", "gid://shopify/Metaobject/790"]

return {
  namespace: "custom",
  key: "produced_by",
  value: JSON.stringify(section.value), // Converts array to JSON string
  type: "list.metaobject_reference"
};
```

**Result:**
```javascript
{
  namespace: "custom",
  key: "produced_by",
  value: '["gid://shopify/Metaobject/789","gid://shopify/Metaobject/790"]',
  type: "list.metaobject_reference"
}
```

---

### New Producer Launchpad App (Current Code)

**In `productCreator.ts` (line ~75):**
```typescript
const productMetafields = [
  // ... other metafields
  {
    namespace: "custom",
    key: "produced_by",
    value: JSON.stringify(data.producerGids), // Already correct!
    type: "list.metaobject_reference",
  },
  // ...
];
```

**Input data:**
```typescript
data.producerGids = [
  "gid://shopify/Metaobject/123",
  "gid://shopify/Metaobject/456"
]
```

**Result:**
```typescript
{
  namespace: "custom",
  key: "produced_by",
  value: '["gid://shopify/Metaobject/123","gid://shopify/Metaobject/456"]',
  type: "list.metaobject_reference"
}
```

**✅ This is correct!** The new app is already formatting metaobject references properly.

---

## How Producer GIDs Are Obtained

### In the New App

**Step 1: Fetch producer metaobjects**
```typescript
// In productCreator.ts:
const producers = await productService.getProducerMetaobjects();
// Returns:
// [
//   { id: "gid://shopify/Metaobject/123", handle: "john-producer", name: "John Producer" },
//   { id: "gid://shopify/Metaobject/456", handle: "jane-beats", name: "Jane Beats" }
// ]
```

**Step 2: User selects producers in form**
```typescript
// Form state:
producerGids = [
  "gid://shopify/Metaobject/123",
  "gid://shopify/Metaobject/456"
]
```

**Step 3: Pass to product creator**
```typescript
await productService.createBeatProduct({
  // ... other fields
  producerGids: ["gid://shopify/Metaobject/123", "gid://shopify/Metaobject/456"],
  // ...
});
```

**Step 4: Build metafield**
```typescript
{
  namespace: "custom",
  key: "produced_by",
  value: JSON.stringify(data.producerGids),
  type: "list.metaobject_reference"
}
```

---

## What Does NOT Get Stored

**❌ Producer name is NOT stored in the metafield**
```javascript
// This is WRONG:
value: '["John Producer", "Jane Beats"]'
```

**✅ Only the GID is stored**
```javascript
// This is CORRECT:
value: '["gid://shopify/Metaobject/123","gid://shopify/Metaobject/456"]'
```

**Why?** Shopify needs the GID to resolve the metaobject reference and give you access to ALL fields (name, image, bio), not just the name.

---

## Single vs. List References

### List Reference (Multiple Values)

**Type:** `list.metaobject_reference`

**Value format:**
```javascript
value: JSON.stringify([
  "gid://shopify/Metaobject/123",
  "gid://shopify/Metaobject/456"
])
```

**Liquid access:**
```liquid
{% for producer in product.metafields.custom.produced_by %}
  {{ producer.name }}
{% endfor %}
```

---

### Single Reference (One Value)

**Type:** `metaobject_reference` (NOT `single.metaobject_reference`)

**Value format:**
```javascript
value: "gid://shopify/Metaobject/123"
// OR (also valid):
value: JSON.stringify("gid://shopify/Metaobject/123")
```

**Liquid access:**
```liquid
{{ variant.metafields.custom.license_reference.license_name }}
```

**Example: Variant License Reference**
```typescript
// Variant metafield:
{
  namespace: "custom",
  key: "license_reference",
  value: "gid://shopify/Metaobject/101", // Single GID, no array
  type: "metaobject_reference"
}
```

---

## Current Implementation Status

### ✅ What's Correct in New App

1. **Metafield type definitions** — All correct in `metafieldSetup.ts`
2. **Metafield value formatting** — `JSON.stringify(data.producerGids)` is correct
3. **GID collection** — Form collects actual GIDs from metaobject query
4. **Producer metaobject schema** — Has `name`, `image`, `bio` fields

### ❌ What's Broken

1. **Metafields aren't being sent to Shopify** — GraphQL mutation doesn't include them
2. **Product creation missing metafields** — Not passed to `createProduct()` call

**The metaobject reference formatting is fine.** The issue is that metafields never reach Shopify.

---

## Verification: How to Check in Shopify Admin

After fixing the upload issue, verify in Shopify Admin:

1. **Go to:** Products → {Your Beat}
2. **Click:** "Metafields" section
3. **Find:** `custom.produced_by`
4. **Expect:**
   ```
   Type: list.metaobject_reference
   Value: Producer (2 selected)
   ```
5. **Click the dropdown** — Should show producer names
6. **Behind the scenes:** Shopify is storing GIDs but displaying names

---

## Storefront Display

### Product Card Example

**Liquid:**
```liquid
<div class="beat-producer">
  {% assign producers = product.metafields.custom.produced_by %}
  {% if producers.size > 0 %}
    <span class="label">Produced by:</span>
    {% for producer in producers %}
      <span class="producer-name">{{ producer.name }}</span>
      {% if forloop.last == false %}, {% endif %}
    {% endfor %}
  {% endif %}
</div>
```

**Output:**
```html
<div class="beat-producer">
  <span class="label">Produced by:</span>
  <span class="producer-name">John Producer</span>, 
  <span class="producer-name">Jane Beats</span>
</div>
```

---

## Summary: The Magic of Metaobject References

### What You Store:
```
'["gid://shopify/Metaobject/789"]'
```

### What Shopify Gives You:
```liquid
{
  id: "gid://shopify/Metaobject/789",
  name: "John Producer",
  image: <file reference>,
  bio: "<p>Music producer</p>"
}
```

### How It Works:
1. You store the **GID** (reference)
2. Shopify **resolves** the reference automatically
3. Storefront gets **full metaobject data**
4. You can access **any field** from the metaobject

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Storing name instead of GID
```javascript
value: '["John Producer"]' // WRONG
```

### ❌ Mistake 2: Not JSON-stringifying the array
```javascript
value: ["gid://shopify/Metaobject/789"] // WRONG (needs to be string)
```

### ❌ Mistake 3: Wrong type for single reference
```javascript
type: "single.metaobject_reference" // WRONG (should be "metaobject_reference")
```

### ✅ Correct Format:
```javascript
{
  namespace: "custom",
  key: "produced_by",
  value: JSON.stringify(["gid://shopify/Metaobject/789"]),
  type: "list.metaobject_reference"
}
```

---

## Related Documentation

- **METAFIELD-IMPLEMENTATION-PLAN.md** — Schema and setup status
- **METAFIELD-UPLOAD-COMPARISON.md** — REST vs GraphQL implementation
- **FORM-TO-METAFIELD-MAPPING.md** — Form fields to metafield mapping

---

**Conclusion:** The new app is already formatting metaobject references correctly. The issue is that these metafields aren't being uploaded to Shopify due to the GraphQL mutation not including them (Phase 1 fix).
