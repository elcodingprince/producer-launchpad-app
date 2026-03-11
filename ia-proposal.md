# Information Architecture Proposal
**Producer Launchpad App**

**Date:** March 11, 2026  
**Reference:** [Navigation Patterns](./skills/shopify-dev/patterns/navigation.md)

---

## Executive Summary

**Problem:** Current IA has empty/placeholder pages, unclear navigation hierarchy, and missing homepage (Dashboard serves as default but blocks incomplete setup).

**Solution:** Consolidate to 5 core pages + setup wizard, following Shopify's "7 items max" navigation rule.

---

## Current State Analysis

| Page | Route | Status | Issues |
|------|-------|--------|--------|
| Dashboard | `/app` | ❌ Blocked | Shows "Unable to load dashboard" if setup incomplete; has placeholder TODOs for data |
| Setup | `/app/setup` | ✅ Functional | Works but should be entry point, not dashboard |
| Upload | `/app/beats/new` | ✅ Functional | Works correctly |
| My Beats | `/app/beats` | ❌ Empty | Returns `beats: []` placeholder |
| Storage | `/app/storage` | ✅ Functional | Storage config works |
| Licenses | `/app/licenses` | ⚠️ Partially functional | Shows licenses but unclear purpose (editing?) |
| **Home Page** | N/A | ❌ Missing | No dedicated homepage following Shopify pattern |

---

## Keep/Kill/Merge Decisions

### ✅ KEEP (5 pages)

| Page | New Name | Route | Reason |
|------|----------|-------|--------|
| **Home** (NEW) | Dashboard | `/app` (homepage URL) | Following Shopify pattern: homepage provides daily value, status updates, CTAs |
| Setup | Setup | `/app/setup` | Required for onboarding (accessed from homepage when incomplete) |
| Upload | Upload Beat | `/app/beats/new` | Core functionality |
| **Beats** (MERGED) | Beats | `/app/beats` | Consolidate "My Beats" + future beat management |
| Settings | Settings | `/app/settings` (NEW) | Consolidate Storage + future configs |

### ❌ KILL (2 pages)

| Page | Reason | Replacement |
|------|--------|-------------|
| Licenses | Unclear purpose; licenses managed in Setup | Setup page handles license definitions |
| Storage (as separate page) | Too granular for nav | Merge into Settings page |

### 🔀 MERGE

| Original Pages | New Page | Reason |
|----------------|----------|--------|
| Storage + (future configs) | Settings | Shopify pattern: group related settings together |
| My Beats (list) + (future beat editing) | Beats | Single resource management page |

---

## New Navigation Structure

**Following Shopify patterns:**
- Max 7 items ✅
- App name points to homepage ✅
- Short, scannable nouns ✅
- No duplicate homepage URL in nav ✅

```
Producer Launchpad (app name → /app homepage)
├── Beats (/app/beats)
├── Settings (/app/settings)
└── Support (/app/support)
```

**Note:** Setup page accessible from homepage banner when setup incomplete (not in nav).

**Total nav items:** 3 (well under 7-item limit)

---

## Page Definitions

### 1. Home (Dashboard) — `/app`

**Purpose:** Provide daily value, status updates, clear CTAs  
**Pattern:** [Home Page](./skills/shopify-dev/patterns/home-page.md)  
**Layout:** Single-column with cards

**Content:**
- **Setup incomplete state:** Banner with "Complete Setup" CTA (primary)
- **Setup complete state:**
  - Quick stats card (Total beats, plays, sales)
  - Primary CTA: "Upload Beat" button
  - Recent beats list (last 5)
  - Performance graph (optional, future)

**Replaces:** Current `app._index.tsx` (blocked dashboard)

---

### 2. Beats — `/app/beats`

**Purpose:** List, manage, edit beats  
**Pattern:** [Resource Index Layout](https://shopify.dev/docs/api/app-home/patterns/templates/index)  
**Layout:** Full-width with IndexTable

**Content:**
- IndexTable with beats (title, status, plays, sales, actions)
- Bulk actions (future: delete, publish, unpublish)
- Search/filter by status, genre, producer
- Primary action: "Upload Beat" (header button)

**Replaces:** `app.beats._index.tsx` (empty placeholder)

---

### 3. Upload Beat — `/app/beats/new`

**Purpose:** Upload new beat with files and metadata  
**Pattern:** [Page Design](./skills/shopify-dev/patterns/page-design.md)  
**Layout:** Single-column

**Content:**
- Beat details form (title, BPM, key, genres, producers)
- File upload (preview, cover, license files)
- Primary action: "Upload Beat"
- Secondary action: "Save Draft"

**Status:** ✅ Already functional (keep as-is)

---

### 4. Settings — `/app/settings` (NEW)

**Purpose:** App configuration (storage, future settings)  
**Pattern:** [Settings Layout](https://shopify.dev/docs/api/app-home/patterns/templates/settings)  
**Layout:** Settings layout (thin left column for labels, wide right for forms)

**Sections:**
- **File Storage**
  - Managed R2 vs Self-Managed
  - R2 credentials
  - Test connection
- **Store Settings** (future)
  - Currency preferences
  - Tax settings
- **Notifications** (future)
  - Email alerts
  - Webhook endpoints

**Replaces:** `app.storage.tsx` (absorbed into Settings)

---

### 5. Setup — `/app/setup`

**Purpose:** Onboarding wizard (metafields, metaobjects, producers, licenses, genres)  
**Pattern:** [Onboarding](https://shopify.dev/docs/apps/design/user-experience/onboarding)  
**Layout:** Settings layout

**Access:** 
- From homepage banner when setup incomplete
- From Settings page (link to re-run setup)

**NOT in main nav** (accessed contextually)

**Status:** ✅ Keep as-is (functional)

---

### 6. Support — `/app/support` (NEW)

**Purpose:** Help, docs, contact  
**Pattern:** [Home Page - Support](./skills/shopify-dev/patterns/home-page.md#support)  
**Layout:** Single-column

**Content:**
- FAQ cards
- Documentation links
- Contact form or email
- Feature request link

---

## Route Mapping

| Old Route | New Route | Page | Notes |
|-----------|-----------|------|-------|
| `/app` | `/app` | Home (Dashboard) | Fix blocked state |
| `/app/setup` | `/app/setup` | Setup | Keep, not in nav |
| `/app/beats/new` | `/app/beats/new` | Upload Beat | Keep as-is |
| `/app/beats` | `/app/beats` | Beats | Implement data loading |
| `/app/storage` | `/app/settings` | Settings | Redirect to Settings |
| `/app/licenses` | `/app/setup` | (merged) | Redirect to Setup or remove |
| N/A | `/app/support` | Support | New page |

---

## Navigation Priority Order

Following Shopify pattern: organize by merchant workflow

1. **Beats** — Primary resource (view/manage beats)
2. **Settings** — Configuration
3. **Support** — Help/docs

**Omitted from nav:**
- Homepage (accessed via app name)
- Setup (contextual, accessed from homepage banner)
- Upload (accessed from primary CTAs on Home and Beats pages)

---

## Implementation Phases

### Phase 1: Fix Homepage (Priority)
- ✅ Remove "blocked dashboard" state
- ✅ Add setup-incomplete banner with "Complete Setup" CTA
- ✅ Add quick stats (with empty state)
- ✅ Add "Upload Beat" primary CTA
- ✅ Add recent beats list (empty state when none)

### Phase 2: Implement Beats Page
- ✅ Fetch actual products from Shopify
- ✅ Display in IndexTable
- ✅ Add search/filter
- ✅ Add bulk actions

### Phase 3: Create Settings Page
- ✅ Move storage config from `/app/storage`
- ✅ Add settings layout
- ✅ Add future setting sections (placeholders)

### Phase 4: Create Support Page
- ✅ Add FAQ cards
- ✅ Add contact form
- ✅ Add documentation links

### Phase 5: Update Navigation
- ✅ Remove old nav items
- ✅ Add new nav structure (Beats, Settings, Support)
- ✅ Update routing redirects

---

## Navigation Code Structure

**Following Shopify pattern (no homepage duplicate):**

```tsx
// App shell navigation
<AppNav>
  {/* NO homepage nav item - app name handles this */}
  <NavItem label="Beats" destination="/app/beats" />
  <NavItem label="Settings" destination="/app/settings" />
  <NavItem label="Support" destination="/app/support" />
</AppNav>
```

**Homepage banner for incomplete setup:**

```tsx
// In app._index.tsx
{!setupStatus.isComplete && (
  <Banner 
    title="Complete setup to start uploading" 
    action={{
      content: "Complete Setup",
      url: "/app/setup"
    }}
  />
)}
```

---

## Compliance Checklist

| Shopify Pattern | Compliance | Notes |
|-----------------|------------|-------|
| Max 7 nav items | ✅ 3 items | Well under limit |
| No duplicate homepage in nav | ✅ | App name → homepage |
| Short, scannable nav labels | ✅ | "Beats", "Settings", "Support" |
| Back navigation without browser | ✅ | Breadcrumbs on detail pages |
| Stay in Shopify admin | ✅ | All pages embedded |
| App name < 20 characters | ✅ | "Producer Launchpad" = 17 chars |
| Homepage provides daily value | ✅ | Stats, CTAs, recent beats |
| Single purpose per page | ✅ | Each page has clear focus |

---

## References

- [Navigation Patterns](./skills/shopify-dev/patterns/navigation.md)
- [Home Page Patterns](./skills/shopify-dev/patterns/home-page.md)
- [Page Design Patterns](./skills/shopify-dev/patterns/page-design.md)
- [Shopify App Structure](https://shopify.dev/docs/apps/design/app-structure)

---

## Next Steps

1. Review and approve IA proposal
2. Create detailed specs for each page:
   - [home-page-spec.md](./home-page-spec.md)
   - [navigation-spec.md](./navigation-spec.md)
   - [subscription-ia.md](./subscription-ia.md)
3. Implement Phase 1 (Fix Homepage)
4. Implement remaining phases sequentially
