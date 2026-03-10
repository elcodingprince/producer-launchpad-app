# Metafield Implementation Plan
**Producer Launchpad App - Beat Product Data Structure**

## Overview
This document maps all metafields and metaobjects created by the setup wizard and tracks their implementation status in the product upload flow.

## 📌 Important TODOs

- **TODO:** Fully set up Producer and Licenses metaobject fields
  - Complete producer profiles with image and bio
  - Complete beat_license metaobjects with all terms and features
  - See Phase 2.5 below for details

## ⚡ Action Items Summary

### Phase 0: Remove `cover_art` Metafield (IMMEDIATE)
**Why:** Cover art should be product's main image, not a custom metafield.
- Remove from `REQUIRED_PRODUCT_METAFIELDS` in `metafieldSetup.ts`
- Remove metafield push in `productCreator.ts`
- Add `images` parameter to `createProduct()` in `shopify.ts`
- Pass `images: [{ src: url }]` array when creating product

### Phase 1: Fix Product Metafield Upload (PRIMARY FIX)
**Why:** Metafields are built but never sent to Shopify.
- Pass `metafields: productMetafields` to `createProduct()` in `productCreator.ts`
- Include metafields in `createInput` before GraphQL mutation in `shopify.ts`

### Phase 2: Verify & Test
- Test variant metafields (`license_reference`)
- Full integration test with core fields
- Verify all fields in Shopify Admin

### Phase 2.5: Complete Metaobject Configuration
**TODO:** Fully set up Producer and Licenses metaobject fields
- Review producer metaobject fields (name, image, bio)
- Review beat_license metaobject fields (all license terms, features, limits)
- Ensure all fields are populated correctly in setup wizard
- Test metaobject display on storefront

### Future: License File Package Architecture
**Status:** Implementation deferred pending architecture decision.
- See "License File Package Strategy" section at end of document
- 3 options presented: Product-level JSON, Variant-level, or Metaobject-based
- Decision needed: How should storefront access purchased files?

---

## 1. Product Metafields (12 Total → 7 Core + 3 TBD)
Created on owner type: `PRODUCT`, namespace: `custom`

### Core Fields (7 Total - Priority)

| Key | Type | Status | Current Implementation | Notes |
|-----|------|--------|------------------------|-------|
| `bpm` | `number_integer` | ⚠️ Not uploading | Built in array but not sent to Shopify | |
| `key` | `single_line_text_field` | ⚠️ Not uploading | Built in array but not sent to Shopify | |
| `audio_preview` | `url` | ⚠️ Not uploading | Built in array but not sent to Shopify | Purpose = "preview" |
| `genre` | `list.metaobject_reference` | ⚠️ Not uploading | Built in array but not sent to Shopify | JSON array of GIDs |
| `produced_by` | `list.metaobject_reference` | ⚠️ Not uploading | Built in array but not sent to Shopify | JSON array of GIDs |
| `producer_alias` | `single_line_text_field` | ⚠️ Not uploading | Optional, not sent to Shopify | |
| `beat_licenses` | `list.metaobject_reference` | ⚠️ Not uploading | Built in array but not sent to Shopify | JSON array of GIDs |

### License File Package Fields (3 Total - Implementation TBD)

| Key | Type | Status | Notes |
|-----|------|--------|-------|
| `license_files_basic` | `json` | 🔄 Architecture decision pending | See "License File Package Strategy" section |
| `license_files_premium` | `json` | 🔄 Architecture decision pending | See "License File Package Strategy" section |
| `license_files_unlimited` | `json` | 🔄 Architecture decision pending | See "License File Package Strategy" section |

### Legacy Fields (Cleanup Required)

| Key | Type | Status | Notes |
|-----|------|--------|-------|
| `cover_art` | `url` | ⚠️ Remove - use product images | Phase 0 cleanup |
| `untagged_mp3` | `url` | ⚠️ Defined but unused | Future cleanup |
| `full_version_zip` | `url` | ⚠️ Defined but unused | Future cleanup |

---

## 2. Variant Metafields (1 Total)
Created on owner type: `PRODUCTVARIANT`, namespace: `custom`

| Key | Type | Status | Current Implementation |
|-----|------|--------|------------------------|
| `license_reference` | `metaobject_reference` | ✅ Working | Each variant references its beat_license metaobject |

**Implementation:** Loops through variants and assigns the corresponding license GID from `data.licenses[i].licenseGid`

---

## 3. Metaobject Definitions (3 Types)

### 3.1 Beat License (`beat_license`)
**Created:** ✅ 3 default instances seeded during setup

| Field Key | Type | Required | Purpose |
|-----------|------|----------|---------|
| `license_id` | `single_line_text_field` | Yes | Unique identifier (basic, premium, unlimited) |
| `license_name` | `single_line_text_field` | Yes | Full name |
| `display_name` | `single_line_text_field` | No | Short name for UI |
| `stream_limit` | `number_integer` | No | Max streams allowed |
| `copy_limit` | `number_integer` | No | Max copies allowed |
| `term_years` | `number_integer` | No | License duration |
| `file_formats` | `single_line_text_field` | No | Included formats (e.g., "MP3, WAV") |
| `includes_stems` | `boolean` | No | Whether stems are included |
| `supports_stems_addon` | `boolean` | No | Whether stems can be added |
| `features_short` | `multi_line_text_field` | No | Short feature list |
| `term_1` through `term_6` | `multi_line_text_field` | No | License terms |

**Default Instances:**
- `basic-license` (Basic License)
- `premium-license` (Premium License)
- `unlimited-license` (Unlimited License)

**📌 TODO:** Populate all optional fields (stream_limit, copy_limit, term_years, file_formats, features_short, term_1-6) for each license tier with actual license terms and conditions.

---

### 3.2 Producer (`producer`)
**Created:** ✅ At least 1 required during setup

| Field Key | Type | Required | Purpose |
|-----------|------|----------|---------|
| `name` | `single_line_text_field` | Yes | Producer name |
| `image` | `file_reference` | No | Producer avatar/logo |
| `bio` | `rich_text_field` or `multi_line_text_field` | No | Producer biography |

**Validation:** Setup rejects "Default Producer" placeholder entries

**📌 TODO:** Complete producer profiles with image and bio fields for production use.

---

### 3.3 Genre (`genre`)
**Created:** ✅ 6 default instances seeded during setup

| Field Key | Type | Required | Purpose |
|-----------|------|----------|---------|
| `title` | `single_line_text_field` | Yes | Genre name |
| `url_slug` | `single_line_text_field` | Yes | URL-safe identifier |
| `description` | `multi_line_text_field` | No | Genre description |
| `brand_color` | `color` | No | Theme color |
| `icon_image` | `file_reference` | No | Genre icon |
| `sort_order` | `number_integer` | No | Display order |

**Default Instances:**
1. `trap` (Trap)
2. `hip-hop` (Hip Hop)
3. `rnb` (R&B)
4. `reggaeton` (Reggaeton)
5. `drill` (Drill)
6. `afrobeats` (Afrobeats)

---

## 4. File Upload Architecture

### 4.1 Current Flow
```
User uploads files → LicenseFileAssignment component → Form submission →
→ Files uploaded to R2 storage → URLs generated → Product created in Shopify
```

### 4.2 File Purpose Tracking
Each uploaded file has:
- `id` - Temporary client-side ID
- `name` - Original filename
- `type` - File type (mp3, wav, stems, cover, other)
- `purpose` - Usage context (preview, license, cover)
- `file` - Actual File object

### 4.3 Storage Implementation
- **Managed R2:** Uses Cloudflare credentials from env vars
- **Self-Managed R2:** Uses shop-specific credentials from database
- **Path structure:** `{beatSlug}/{timestamp}-{filename}`

### 4.4 Database Tracking
**Tables:**
- `BeatFile` - Stores metadata for each uploaded file
- `LicenseFileMapping` - Maps files to license tiers

---

## 5. Current Status Summary

### ❌ **CRITICAL ISSUE IDENTIFIED**

**Problem:** Metafields are NOT being uploaded to Shopify products.

**Evidence:**
- Only `title` field works correctly
- `bpm` and `key` appear in product description (HTML) instead of metafields
- No metafields visible in Shopify Admin after upload

**Root Cause:** (See `METAFIELD-UPLOAD-COMPARISON.md` for full analysis)
1. `productMetafields` array is built correctly in `productCreator.ts`
2. **BUT:** Metafields are never passed to `createProduct()` call
3. **AND:** Even if passed, `shopify.ts` strips them from `createInput` before GraphQL mutation

### 📋 Working Components
- Form data collection ✅
- File uploads to R2 storage ✅
- Metafield array construction ✅
- Database record creation ✅

### ❌ Broken Components
- GraphQL `productCreate` mutation doesn't include metafields
- `setMetafields()` fallback not being called for product-level metafields
- Metafields never reach Shopify API

---

## 6. Verification Checklist

After any changes, verify:

- [ ] `bpm` and `key` are set correctly from form fields
- [ ] `audio_preview` contains the preview file URL
- [ ] Cover art appears in product `images` array (NOT in metafields)
- [ ] `genre` and `produced_by` contain valid metaobject reference arrays
- [ ] `beat_licenses` contains valid license references
- [ ] `license_files_basic`, `license_files_premium`, `license_files_unlimited` contain correct file arrays
- [ ] Database `BeatFile` records are created for all uploads
- [ ] Database `LicenseFileMapping` records link files to tiers
- [ ] Variant `license_reference` maps each variant to correct license

---

## 7. File Location Reference

| File | Purpose | Fix Needed? |
|------|---------|-------------|
| `app/services/metafieldSetup.ts` | Defines all metafield schemas | No |
| `app/services/productCreator.ts` | Creates products and sets metafields | **YES** (line ~155) |
| `app/services/shopify.ts` | GraphQL client and mutations | **YES** (line ~451) |
| `app/services/storageUpload.server.ts` | Handles file uploads to R2 | No |
| `app/routes/app.beats.new.tsx` | Upload form and orchestration | No |
| `app/components/LicenseFileAssignment.tsx` | File upload UI component | No |

## 8. Related Documentation

- **`METAFIELD-UPLOAD-COMPARISON.md`** — Detailed comparison of original beat-uploader (REST API) vs. new app (GraphQL)
  - Includes working code examples from original app
  - Root cause analysis of current bug
  - Step-by-step fix implementation
  - Verification checklist

- **`METAOBJECT-REFERENCE-GUIDE.md`** — How metaobject references work in Shopify
  - GID storage format (JSON-stringified arrays)
  - How Shopify resolves references on storefront
  - Producer metaobject → `name` field display
  - Current implementation is CORRECT (just not uploading yet)
  - Single vs. list reference formatting

---

## Next Steps

### Phase 0: Remove Unused Image Metafield
**Background:** Cover art should use the product `images` array, not a custom metafield.

**Files to modify:**
1. **`app/services/metafieldSetup.ts`:**
   - Remove `cover_art` from `REQUIRED_PRODUCT_METAFIELDS` array
   - Update total count in comments/docs

2. **`app/services/productCreator.ts`:**
   - Remove code that adds `cover_art` metafield (if present)
   - Update to pass `coverArtUrl` to product `images` field instead

3. **`app/services/shopify.ts`:**
   - Ensure `createProduct()` accepts `images` array parameter
   - Pass images to GraphQL mutation

**Expected changes:**
```typescript
// REMOVE from REQUIRED_PRODUCT_METAFIELDS:
{
  name: "Cover Art",
  namespace: "custom",
  key: "cover_art",
  type: "url",
  description: "URL to the cover art image",
}

// ADD to createProduct input:
images?: Array<{ src: string }>;

// USE in productCreator:
const product = await this.client.createProduct({
  title: data.title,
  // ... other fields
  images: data.coverArtUrl ? [{ src: data.coverArtUrl }] : [],
});
```

**Verification:**
- [ ] Setup wizard no longer creates `custom.cover_art` metafield definition
- [ ] Product upload uses `images` array instead
- [ ] Cover art displays as main product image in Shopify Admin

---

### Phase 1: Fix Product Metafield Upload
1. **Modify `productCreator.ts` (line ~155):**
   - Pass `metafields: productMetafields` to `createProduct()` call

2. **Modify `shopify.ts` (line ~451):**
   - Extract `metafields` from input destructuring
   - Add metafields to `createInput` before GraphQL mutation
   - Ensure format matches GraphQL `ProductInput` schema

3. **Test upload with sample beat:**
   - Verify `bpm` appears as metafield (not in description)
   - Verify `key` appears as metafield
   - Check all 11 product metafields in Shopify Admin

### Phase 2: Verify Variant Metafields
1. **Confirm `license_reference` is being set on variants**
2. **Check database `LicenseFileMapping` records**

### Phase 3: Full Integration Test
1. **Upload complete beat** with all files
2. **Verify in Shopify Admin:**
   - Product metafields populated
   - Variant metafields populated
   - Files accessible via URLs
3. **Test storefront display** (if theme configured)

---

## 🧹 Cleanup Section

### Phase 0: Remove `cover_art` Metafield (IMMEDIATE)

**Why:** Cover art should be the product's main image, not a metafield.

**Files to modify:**

1. **`app/services/metafieldSetup.ts`** (line ~30):
   ```typescript
   // REMOVE THIS ENTRY:
   {
     name: "Cover Art",
     namespace: "custom",
     key: "cover_art",
     type: "url",
     description: "URL to the cover art image",
   },
   ```

2. **`app/services/productCreator.ts`** (line ~115):
   ```typescript
   // REMOVE THIS BLOCK:
   if (data.coverArtUrl) {
     productMetafields.push({
       namespace: "custom",
       key: "cover_art",
       value: data.coverArtUrl,
       type: "url",
     });
   }
   ```

3. **`app/services/productCreator.ts`** (add to createProduct call):
   ```typescript
   const product = await this.client.createProduct({
     title: data.title,
     // ... existing fields ...
     images: data.coverArtUrl ? [{ src: data.coverArtUrl }] : [], // ADD THIS
   });
   ```

4. **`app/services/shopify.ts`** (line ~451, update interface):
   ```typescript
   async createProduct(input: {
     title: string;
     descriptionHtml?: string;
     vendor?: string;
     productType?: string;
     tags?: string[];
     images?: Array<{ src: string }>; // ADD THIS
     variants: Array<{...}>;
     metafields?: Array<{...}>;
   }) {
   ```

5. **`app/services/shopify.ts`** (line ~495, update mutation):
   ```graphql
   mutation CreateProduct($input: ProductInput!) {
     productCreate(input: $input) {
       product {
         id
         title
         images(first: 10) {  # ADD THIS
           edges {
             node {
               id
               url
             }
           }
         }
         variants(first: 100) { ... }
       }
     }
   }
   ```

**Result:** Cover art will be the product's primary image, visible in Shopify Admin and storefront automatically.

---

### Future Work: Legacy Fields `untagged_mp3` and `full_version_zip`

**Current state:**
- Both fields are defined in the setup wizard
- Neither is populated during product creation
- Files ARE uploaded to storage and tracked in database
- License-specific files are stored in `license_files_*` JSON metafields

**Decision needed:**
- Are these fields still required, or can they be removed from the schema?
- If required: determine which uploaded file maps to each field
- If not required: remove from `REQUIRED_PRODUCT_METAFIELDS` array

**Proposed implementation (if needed):**
```typescript
// In productCreator.ts, after license file bundles:

// Find the primary untagged MP3 file (not preview)
const untaggedMp3File = uploadResults.find(
  (r, idx) => 
    fileEntries[idx].purpose === 'license' && 
    r.fileType === 'mp3' &&
    fileEntries[idx].tempId !== previewFileId
);

if (untaggedMp3File) {
  productMetafields.push({
    namespace: "custom",
    key: "untagged_mp3",
    value: untaggedMp3File.storageUrl,
    type: "url",
  });
}

// Find the stems/full version ZIP
const fullVersionZip = uploadResults.find(
  (r) => r.fileType === 'stems'
);

if (fullVersionZip) {
  productMetafields.push({
    namespace: "custom",
    key: "full_version_zip",
    value: fullVersionZip.storageUrl,
    type: "url",
  });
}
```

---

## 📦 License File Package Strategy (Implementation TBD)

### Current Situation

**What exists now:**
- 3 product metafields defined: `license_files_basic`, `license_files_premium`, `license_files_unlimited`
- Type: `json`
- Purpose: Store file mappings for each license tier
- Files are uploaded to R2 storage ✅
- URLs are generated and tracked in database ✅
- **BUT:** How files map to license tiers is not finalized

**What works:**
- File uploads to storage
- Database tracking (`BeatFile` and `LicenseFileMapping` tables)
- UI for file assignment to tiers

**What's unclear:**
- Should files be stored as product metafields OR variant metafields?
- How should the storefront access license-specific files?
- Should we use the current JSON metafield approach or a different architecture?

---

### Architecture Options

#### Option 1: Product-Level JSON Metafields (Current)
Store all tier-specific files as JSON arrays on the product.

**Implementation:**
```typescript
// Product metafields:
custom.license_files_basic = '[
  {"id":"abc","name":"beat.mp3","url":"https://...","type":"mp3"},
  {"id":"def","name":"beat.wav","url":"https://...","type":"wav"}
]'

custom.license_files_premium = '[
  {"id":"abc","name":"beat.mp3","url":"https://...","type":"mp3"},
  {"id":"def","name":"beat.wav","url":"https://...","type":"wav"},
  {"id":"ghi","name":"beat-stems.zip","url":"https://...","type":"stems"}
]'

custom.license_files_unlimited = '[...]'
```

**Pros:**
- Simple to implement
- All files in one place
- Easy to query from product page

**Cons:**
- Files not directly tied to variant (user must map license → files)
- Storefront needs extra logic to match purchased variant to file bundle
- Redundant if same file appears in multiple tiers

---

#### Option 2: Variant-Level File References
Store files on each variant that represents a license tier.

**Implementation:**
```typescript
// Variant 1 (Basic):
custom.license_reference = "gid://shopify/Metaobject/101"  // Existing
custom.license_files = '[
  {"id":"abc","name":"beat.mp3","url":"https://...","type":"mp3"}
]'

// Variant 2 (Premium):
custom.license_reference = "gid://shopify/Metaobject/102"  // Existing
custom.license_files = '[
  {"id":"abc","name":"beat.mp3","url":"https://...","type":"mp3"},
  {"id":"def","name":"beat.wav","url":"https://...","type":"wav"}
]'

// Variant 3 (Unlimited):
custom.license_reference = "gid://shopify/Metaobject/103"  // Existing
custom.license_files = '[
  {"id":"abc","name":"beat.mp3","url":"https://...","type":"mp3"},
  {"id":"def","name":"beat.wav","url":"https://...","type":"wav"},
  {"id":"ghi","name":"stems.zip","url":"https://...","type":"stems"}
]'
```

**Pros:**
- Files directly tied to purchased variant
- Storefront can access files via `order.line_items[].variant.metafields`
- Cleaner separation of concerns

**Cons:**
- More variant metafields to manage
- Requires updating variant metafield definitions
- File duplication across variants (if same file in multiple tiers)

---

#### Option 3: Metaobject-Based File References
Create a `license_file` metaobject type and reference files from licenses.

**Implementation:**
```typescript
// Create metaobject definition:
type: "license_file"
fields: [
  { key: "file_url", type: "url" },
  { key: "file_name", type: "single_line_text_field" },
  { key: "file_type", type: "single_line_text_field" },
  { key: "file_size", type: "number_integer" }
]

// Reference from beat_license metaobject:
beat_license.files = [
  "gid://shopify/Metaobject/file-001",
  "gid://shopify/Metaobject/file-002"
]

// Variant still references license:
variant.custom.license_reference = "gid://shopify/Metaobject/101"
```

**Pros:**
- Most structured approach
- Files are reusable across products
- Easy to update file URLs globally
- Follows Shopify's metaobject pattern

**Cons:**
- Most complex to implement
- Requires additional metaobject setup
- More API calls to resolve references
- Overkill for single-product file management

---

### Current Implementation Status

**What's built:**
1. ✅ File upload UI (LicenseFileAssignment component)
2. ✅ File storage (R2 upload)
3. ✅ Database tracking (`BeatFile`, `LicenseFileMapping`)
4. ✅ Product metafield definitions (`license_files_basic/premium/unlimited`)
5. ✅ Metafield array construction in `productCreator.ts`

**What's working:**
- Files upload successfully
- URLs are generated
- Arrays are built correctly
- Database records are created

**What's NOT working:**
- Metafields aren't being sent to Shopify (Phase 1 fix needed first)

---

### Recommended Approach

**Phase 1:** Fix core metafield upload first (BPM, key, genres, etc.)
**Phase 2:** Test with Option 1 (current product-level JSON approach)
**Phase 3:** Evaluate based on storefront needs:
- If storefront easily maps license → files from product metafields → Keep Option 1
- If storefront struggles to connect variant → files → Switch to Option 2
- If managing files across multiple products becomes painful → Consider Option 3

---

### Decision Checklist

Before finalizing license file package architecture, answer:

- [ ] How will the storefront access files after purchase?
- [ ] Does the theme/app have access to variant metafields on order confirmation?
- [ ] Will files be duplicated across tiers, or are they unique per tier?
- [ ] Do we need to update file URLs in bulk across products?
- [ ] Is file management per-product or global (across catalog)?
- [ ] What's the performance impact of multiple API calls to resolve references?

---

### Files Affected (When Implementing)

| File | Change Needed | Option 1 | Option 2 | Option 3 |
|------|---------------|----------|----------|----------|
| `metafieldSetup.ts` | Metafield definitions | Current OK | Add variant `license_files` | Add `license_file` metaobject |
| `productCreator.ts` | Metafield construction | Current OK | Build variant metafields | Create file metaobjects |
| `shopify.ts` | GraphQL mutations | Current OK | Update variant metafield mutation | Add metaobject create mutation |
| Storefront theme | File access logic | Query product metafields | Query variant metafields | Resolve metaobject references |

---

**Status:** Architecture decision pending. Implement Phase 1 (core metafield fix) first, then revisit this section.
