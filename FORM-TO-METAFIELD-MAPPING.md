# Form Field to Metafield Mapping
**Upload Page → Shopify Product Metafields**

---

## Form Fields in Upload Page

### Beat Details Card

| Form Field | Input Type | State Variable | Required | Goes To |
|------------|-----------|----------------|----------|---------|
| **Beat Title** | `TextField` | `title` | Yes | Product `title` (not metafield) |
| **BPM** | `TextField` (number) | `bpm` | Yes | `custom.bpm` metafield |
| **Key** | `Select` | `key` | Yes | `custom.key` metafield |
| **Producers** | `ChoiceList` (multi) | `producerGids[]` | Yes | `custom.produced_by` metafield |
| **Genres** | `ChoiceList` (multi) | `genreGids[]` | Yes | `custom.genre` metafield |
| **Producer Alias** | `TextField` | `producerAlias` | No | `custom.producer_alias` metafield |

### License File Assignment Component

| Form Field | Input Type | State Variable | Required | Goes To |
|------------|-----------|----------------|----------|---------|
| **Preview File** | File upload | `previewFile` | Yes | `custom.audio_preview` metafield (URL) |
| **Cover Image** | File upload | Detected by purpose | Optional | Product `images` array (NOT metafield) |
| **License Files (Basic)** | File upload + assignment | `licenseFiles.basic[]` | Yes | `custom.license_files_basic` metafield (JSON) |
| **License Files (Premium)** | File upload + assignment | `licenseFiles.premium[]` | Yes | `custom.license_files_premium` metafield (JSON) |
| **License Files (Unlimited)** | File upload + assignment | `licenseFiles.unlimited[]` | Yes | `custom.license_files_unlimited` metafield (JSON) |

---

## Data Flow: Form → Metafield

### 1. Beat Title
```
Form: title = "Dark Trap Beat"
  ↓
Product field: title = "Dark Trap Beat"
```
**Not a metafield** — goes directly to product title.

---

### 2. BPM
```
Form: bpm = "140"
  ↓
Parsed: parseInt("140", 10) = 140
  ↓
Metafield:
  namespace: "custom"
  key: "bpm"
  value: "140"  ← Converted back to string
  type: "number_integer"
```
**Current bug:** Ends up in product description instead.

---

### 3. Key
```
Form: key = "G minor"
  ↓
Metafield:
  namespace: "custom"
  key: "key"
  value: "G minor"
  type: "single_line_text_field"
```
**Current bug:** Ends up in product description instead.

---

### 4. Genres (Multi-select)
```
Form: genreGids = [
  "gid://shopify/Metaobject/123",
  "gid://shopify/Metaobject/456"
]
  ↓
Metafield:
  namespace: "custom"
  key: "genre"
  value: '["gid://shopify/Metaobject/123","gid://shopify/Metaobject/456"]'
  type: "list.metaobject_reference"
```
**Note:** Value must be JSON stringified array of GIDs.

---

### 5. Producers (Multi-select)
```
Form: producerGids = [
  "gid://shopify/Metaobject/789"
]
  ↓
Metafield:
  namespace: "custom"
  key: "produced_by"
  value: '["gid://shopify/Metaobject/789"]'
  type: "list.metaobject_reference"
```
**Note:** Value must be JSON stringified array of GIDs.

---

### 6. Producer Alias (Optional)
```
Form: producerAlias = "PRODBYRICH"
  ↓
Metafield (only if not empty):
  namespace: "custom"
  key: "producer_alias"
  value: "PRODBYRICH"
  type: "single_line_text_field"
```

---

### 7. Preview Audio File
```
Form: previewFile = {
  id: "temp-123",
  file: File object,
  purpose: "preview"
}
  ↓
Upload to R2 storage
  ↓
Result: storageUrl = "https://cdn.example.com/beat-slug/preview.mp3"
  ↓
Metafield:
  namespace: "custom"
  key: "audio_preview"
  value: "https://cdn.example.com/beat-slug/preview.mp3"
  type: "url"
```

---

### 8. Cover Art (Optional)
```
Form: uploadedFiles = [
  {
    id: "temp-456",
    file: File object,
    purpose: "cover",
    type: "cover"
  }
]
  ↓
Upload to R2 storage
  ↓
Result: storageUrl = "https://cdn.example.com/beat-slug/cover.jpg"
  ↓
Product images array (only if uploaded):
  images: [
    { src: "https://cdn.example.com/beat-slug/cover.jpg" }
  ]
```
**Note:** NOT a metafield — goes directly to product `images` array as main product image.

---

### 9. License Files (Per Tier)
```
Form: licenseFiles = {
  basic: ["temp-111", "temp-222"],
  premium: ["temp-111", "temp-222", "temp-333"],
  unlimited: ["temp-111", "temp-222", "temp-333", "temp-444"]
}
  ↓
Upload all files to R2 storage
  ↓
Results: {
  "temp-111": { storageUrl: "https://cdn.../file1.mp3", ... },
  "temp-222": { storageUrl: "https://cdn.../file2.wav", ... },
  "temp-333": { storageUrl: "https://cdn.../file3.wav", ... },
  "temp-444": { storageUrl: "https://cdn.../stems.zip", ... }
}
  ↓
Basic tier metafield:
  namespace: "custom"
  key: "license_files_basic"
  value: '[
    {"id":"abc","name":"file1.mp3","url":"https://...","type":"mp3"},
    {"id":"def","name":"file2.wav","url":"https://...","type":"wav"}
  ]'
  type: "json"
  
Premium tier metafield:
  namespace: "custom"
  key: "license_files_premium"
  value: '[
    {"id":"abc","name":"file1.mp3","url":"https://...","type":"mp3"},
    {"id":"def","name":"file2.wav","url":"https://...","type":"wav"},
    {"id":"ghi","name":"file3.wav","url":"https://...","type":"wav"}
  ]'
  type: "json"
  
Unlimited tier metafield:
  namespace: "custom"
  key: "license_files_unlimited"
  value: '[
    {"id":"abc","name":"file1.mp3","url":"https://...","type":"mp3"},
    {"id":"def","name":"file2.wav","url":"https://...","type":"wav"},
    {"id":"ghi","name":"file3.wav","url":"https://...","type":"wav"},
    {"id":"jkl","name":"stems.zip","url":"https://...","type":"stems"}
  ]'
  type: "json"
```

---

### 10. Beat Licenses (Generated)
```
Not from form — generated from license metaobjects
  ↓
Query: getLicenseMetaobjects() returns:
[
  { id: "gid://shopify/Metaobject/101", licenseId: "basic", ... },
  { id: "gid://shopify/Metaobject/102", licenseId: "premium", ... },
  { id: "gid://shopify/Metaobject/103", licenseId: "unlimited", ... }
]
  ↓
Metafield:
  namespace: "custom"
  key: "beat_licenses"
  value: '[
    "gid://shopify/Metaobject/101",
    "gid://shopify/Metaobject/102",
    "gid://shopify/Metaobject/103"
  ]'
  type: "list.metaobject_reference"
```

---

## Variant Metafields

Each variant (Basic, Premium, Unlimited) gets:

```
Variant 1 (Basic):
  namespace: "custom"
  key: "license_reference"
  value: "gid://shopify/Metaobject/101"
  type: "metaobject_reference"
  
Variant 2 (Premium):
  namespace: "custom"
  key: "license_reference"
  value: "gid://shopify/Metaobject/102"
  type: "metaobject_reference"
  
Variant 3 (Unlimited):
  namespace: "custom"
  key: "license_reference"
  value: "gid://shopify/Metaobject/103"
  type: "metaobject_reference"
```

---

## Summary Table

| Form Field | Metafield Namespace | Metafield Key | Type | Required |
|------------|-------------------|---------------|------|----------|
| Beat Title | N/A | N/A | Product field | Yes |
| BPM | `custom` | `bpm` | `number_integer` | Yes |
| Key | `custom` | `key` | `single_line_text_field` | Yes |
| Genres | `custom` | `genre` | `list.metaobject_reference` | Yes |
| Producers | `custom` | `produced_by` | `list.metaobject_reference` | Yes |
| Producer Alias | `custom` | `producer_alias` | `single_line_text_field` | No |
| Preview File | `custom` | `audio_preview` | `url` | Yes |
| Cover Art | N/A | N/A | Product `images` array | No |
| License Files (Basic) | `custom` | `license_files_basic` | `json` | TBD |
| License Files (Premium) | `custom` | `license_files_premium` | `json` | TBD |
| License Files (Unlimited) | `custom` | `license_files_unlimited` | `json` | TBD |
| (Generated) | `custom` | `beat_licenses` | `list.metaobject_reference` | Auto |

**Total Product Metafields:** 7 core (or 8 with producer_alias) + 3 license file packages (TBD)
**Total Variant Metafields:** 1 per variant (3 total)
**Additional Product Fields:** Product `images` array for cover art

**Note:** License file package implementation is deferred. See `METAFIELD-IMPLEMENTATION-PLAN.md` → "License File Package Strategy" section for architecture options.

---

## Code Location Reference

**Form fields defined:**
- `app/routes/app.beats.new.tsx` (lines 520-650)

**Form data extracted:**
- `app/routes/app.beats.new.tsx` (action function, lines 118-126)

**Metafield array built:**
- `app/services/productCreator.ts` (lines 60-130)

**Metafields should be passed:**
- `app/services/productCreator.ts` (line ~155) ← **FIX NEEDED**

**GraphQL mutation:**
- `app/services/shopify.ts` (line ~451) ← **FIX NEEDED**
