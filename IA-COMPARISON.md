# IA Proposal Comparison
**Producer Launchpad App - Two Approaches**

**Date:** March 11, 2026

---

## Executive Summary

Two complete IA proposals exist:

1. **Existing Proposal** (`/patterns/`) - Created earlier today
2. **New Proposal** (`ia-proposal.md` + specs) - Created just now

**Recommendation:** **Hybrid approach** combining the best of both.

---

## Side-by-Side Comparison

| Aspect | Existing Proposal | New Proposal | Winner |
|--------|-------------------|--------------|--------|
| **Nav Items** | 5 (Home, Upload, Settings, Plans, Help) | 3 (Beats, Settings, Support) | ✅ New (simpler) |
| **Homepage** | Home page with stats | Dashboard (Home) with stats | ✅ Tie (same concept) |
| **Upload** | Nav item with tabs | CTA access only (not in nav) | ✅ Existing (more discoverable) |
| **Beats Management** | "Uploaded Files" tab in Upload | Dedicated "Beats" page | ✅ New (better naming) |
| **Settings** | Consolidates Setup + Storage | Consolidates Storage only | ✅ Existing (more complete) |
| **Subscription** | "Plans" page | Pricing + gating flow | ✅ New (better billing implementation) |
| **Pattern Documentation** | `shopify-do-dont.md` (consolidated) | Separate pattern files | ✅ New (more organized) |
| **Implementation Detail** | High-level roadmap | Complete code specs | ✅ New (ready to build) |

---

## Detailed Comparison

### 1. Navigation Structure

#### Existing Proposal
```
🏠 Home                    
📤 Upload (with tabs)      
⚙️  Settings (Setup + Storage)
💳 Plans                   
❓ Help & Support          
```

**Pros:**
- Upload is discoverable in nav
- Clear subscription section (Plans)
- 5 items (under Shopify's 7-item limit)

**Cons:**
- Could be simplified further
- "Upload" is a verb (Shopify prefers nouns)

#### New Proposal
```
Producer Launchpad (app name → /app)
├── Beats         
├── Settings      
└── Support       
```

**Pros:**
- Only 3 items (very clean)
- All nouns (follows Shopify pattern)
- No homepage duplicate in nav

**Cons:**
- Upload not directly in nav (accessed via CTAs)
- Might be less discoverable for first-time users

**Verdict:** ✅ **New wins** for simplicity, but upload discoverability is a concern.

---

### 2. Homepage

#### Existing Proposal
**Content:**
- Welcome section with merchant name
- Stats overview (Total Uploads, Storage Used, Recent Activity)
- Quick actions (Upload Files, Manage Settings, View Plans)
- Support CTAs

#### New Proposal
**Content:**
- Setup incomplete banner (if applicable)
- Quick stats (Total Beats, Plays, Sales)
- "Upload First Beat" CTA (if no beats)
- Recent beats list (last 5)
- Support footer

**Verdict:** ✅ **Tie** - Both provide daily value, stats, and CTAs. New is more specific to "beats" context.

---

### 3. Upload vs Beats

#### Existing Proposal: "Upload Page" with Tabs
- Tab 1: Upload Files (upload action)
- Tab 2: Uploaded Files (list view)
- Tab 3: Upload History (timeline)

**Pros:**
- Everything upload-related in one place
- Tabs make sense for related views

**Cons:**
- "Upload" is verb-focused, not resource-focused
- Mixes action (upload) with management (list)

#### New Proposal: "Beats Page" + Upload CTA
- Beats page: Resource index (list, search, filter)
- Upload accessed via: "Upload Beat" primary action button
- Upload form: Separate route (`/app/beats/new`)

**Pros:**
- "Beats" is noun (resource-focused)
- Follows Shopify pattern: main pages in nav, actions via buttons
- Clear separation: management vs. creation

**Cons:**
- Upload not directly in nav (might feel hidden)

**Verdict:** ✅ **New wins** for Shopify pattern compliance, but **existing has better discoverability**.

---

### 4. Settings Page

#### Existing Proposal
**Sections:**
1. Setup Configuration (from Setup page)
2. Storage Settings (from Storage Settings page)
3. General Preferences (new - notifications, etc.)

**Pros:**
- Fully consolidates Setup + Storage
- Logical grouping
- Room for future settings

#### New Proposal
**Sections:**
1. File Storage (from Storage page)
2. Store Settings (future)
3. Notifications (future)

**Pros:**
- Clean separation
- Future-ready

**Cons:**
- Doesn't mention consolidating Setup page

**Verdict:** ✅ **Existing wins** - more complete consolidation (includes Setup).

---

### 5. Subscription Management

#### Existing Proposal: "Plans Page"
- Current plan overview
- Available plans (pricing cards)
- Billing history
- Upgrade/downgrade CTAs
- Separate `/app/pricing` for selection

**Pros:**
- Dedicated subscription management page
- Clear "Plans" label

**Cons:**
- Less detail on billing implementation

#### New Proposal: Pricing + Gating Flow
- No dedicated "Plans" nav item
- Pricing page (`/app/pricing`) accessed from CTAs
- Route gating with `billing.require()`
- Trial banners on homepage
- Complete React Router billing code

**Pros:**
- More detailed billing implementation
- Better gating examples
- Complete code specs

**Cons:**
- No dedicated subscription management page in nav

**Verdict:** ✅ **New wins** for implementation detail, but **existing wins** for discoverability.

---

### 6. Pattern Documentation

#### Existing Proposal
- `shopify-do-dont.md` (9.2 KB) - All patterns in one file

**Pros:**
- Everything in one place
- Easy to search

**Cons:**
- Large file (harder to navigate)
- No separation by topic

#### New Proposal
- `skills/shopify-dev/` with separate files:
  - `home-page.md`
  - `navigation.md`
  - `page-design.md`
  - `billing.md`

**Pros:**
- Topic-based organization
- Each file focused on one area
- Easier to maintain

**Cons:**
- Spread across multiple files

**Verdict:** ✅ **New wins** - better organization for long-term maintenance.

---

### 7. Implementation Guidance

#### Existing Proposal
- `implementation-roadmap.md` (15 KB)
- Phased rollout (4-6 weeks)
- High-level tasks per phase
- Dependencies and risks

**Pros:**
- Timeline estimates
- Clear phases
- Risk analysis

**Cons:**
- Less code detail

#### New Proposal
- `home-page-spec.md` (9.7 KB)
- `navigation-spec.md` (9.3 KB)
- `subscription-ia.md` (13.9 KB)
- Complete code examples
- Loader/action functions
- Polaris components with props

**Pros:**
- Implementation-ready code
- Copy-paste examples
- Detailed specs per page

**Cons:**
- No timeline estimates

**Verdict:** ✅ **New wins** for code detail, **existing wins** for project planning.

---

## Key Philosophical Differences

### Navigation Philosophy

**Existing:** "Make everything easily accessible in nav"
- Upload in nav with tabs
- Plans in nav
- 5 items (moderate)

**New:** "Minimal nav, actions via CTAs"
- Beats in nav (resource focus)
- Upload via CTA (action focus)
- 3 items (minimalist)

**Shopify Pattern Says:**
> "Use the fewest possible categories to define what your app does."  
> "Navigation should be built around what merchants need to do."

**Verdict:** Both interpretations are valid. **New is more minimalist**, **existing is more discoverable**.

---

### Resource vs Action Naming

**Existing:**
- "Upload" (verb/action)
- "Plans" (noun/resource)

**New:**
- "Beats" (noun/resource)
- "Settings" (noun/resource)

**Shopify Pattern Says:**
> "Make navigation items short and scannable. Use nouns instead of verbs to keep the navigation menu concise."

**Verdict:** ✅ **New wins** - more consistent use of nouns.

---

## Hybrid Recommendation

**Best of both worlds:**

### Navigation (4 items)
```
Producer Launchpad (app name → /app)
├── Beats         [From New - resource focus]
├── Upload        [From Existing - discoverability]
├── Settings      [From Existing - consolidates Setup + Storage]
└── Support       [From New - consistent naming]
```

**Why 4 items:**
- Beats: Resource management (list, edit)
- Upload: Direct action access (discoverable)
- Settings: Configuration (fully consolidated)
- Support: Help (consistent)

**Compromise:**
- Keep "Upload" in nav for discoverability (existing)
- Use "Beats" for management page (new)
- Rename "Upload" to "Upload Beats" to make it more noun-focused
- Drop "Plans" nav item, use pricing page + trial banners (new)

---

### Page Structure (Hybrid)

| Page | Route | Source | Notes |
|------|-------|--------|-------|
| **Home** | `/app` | Both | Stats + CTAs (both proposals similar) |
| **Beats** | `/app/beats` | New | Resource index, replaces "Uploaded Files" |
| **Upload** | `/app/upload` | Existing | Dedicated upload page (better discoverability) |
| **Settings** | `/app/settings` | Existing | Consolidates Setup + Storage fully |
| **Pricing** | `/app/pricing` | New | Subscription selection (not in nav) |
| **Support** | `/app/support` | Both | Help, docs, contact |

---

### Pattern Documentation (New)

Use the new structure:
```
skills/shopify-dev/
├── SKILL.md
└── patterns/
    ├── home-page.md
    ├── navigation.md
    ├── page-design.md
    └── billing.md
```

**Why:** Better organization for long-term maintenance.

---

### Implementation Specs (New)

Use the new detailed specs:
- `home-page-spec.md`
- `navigation-spec.md`
- `subscription-ia.md`

**Plus add from existing:**
- `implementation-roadmap.md` (timeline + phases)

**Why:** New has better code detail, existing has better project planning.

---

## Final Recommendation

### Phase 1: Adopt Hybrid Approach

**Navigation:**
```
🏠 Producer Launchpad (→ /app)
   ├── Beats
   ├── Upload
   ├── Settings
   └── Support
```

**Implementation order:**
1. Use **new pattern files** for design reference
2. Use **new detailed specs** for implementation
3. Use **existing roadmap** for timeline planning
4. Combine **both homepage concepts** (stats from both)
5. Keep **Upload in nav** (existing) for discoverability
6. Add **Beats page** (new) for resource management
7. Fully consolidate **Settings** (existing) including Setup
8. Use **pricing flow** (new) for subscriptions

---

## Comparison Summary

| Criteria | Existing | New | Hybrid |
|----------|----------|-----|--------|
| **Simplicity** | 🟡 Good (5 items) | 🟢 Excellent (3 items) | 🟢 Great (4 items) |
| **Discoverability** | 🟢 Excellent | 🟡 Good | 🟢 Excellent |
| **Shopify Compliance** | 🟢 Good | 🟢 Excellent | 🟢 Excellent |
| **Pattern Docs** | 🟡 Good (1 file) | 🟢 Excellent (organized) | 🟢 Use new |
| **Implementation Detail** | 🟡 Good (high-level) | 🟢 Excellent (code-ready) | 🟢 Use new |
| **Project Planning** | 🟢 Excellent (timeline) | 🟡 Good (no timeline) | 🟢 Use existing |
| **Settings Consolidation** | 🟢 Complete | 🟡 Partial | 🟢 Use existing |
| **Subscription Detail** | 🟡 Good | 🟢 Excellent | 🟢 Use new |

---

## Action Items

1. ✅ Use **new pattern files** (`skills/shopify-dev/patterns/`)
2. ✅ Adopt **hybrid navigation** (4 items: Beats, Upload, Settings, Support)
3. ✅ Use **new implementation specs** for building
4. ✅ Add **existing roadmap** for timeline tracking
5. ✅ Fully consolidate Settings (Setup + Storage) per existing proposal
6. ✅ Implement subscription flow per new proposal (more detail)

---

**Conclusion:** Neither proposal is strictly "better" — each has strengths. The hybrid approach captures the best of both: **new's minimalism + pattern organization + implementation detail**, combined with **existing's discoverability + complete consolidation + project planning**.
