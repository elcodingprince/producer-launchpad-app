# MVP Information Architecture Proposal
**Producer Launchpad - Shopify App**

**Date:** March 11, 2026  
**Status:** Proposed  
**Scope:** MVP (Minimum Viable Product)

---

## Executive Summary

**Purpose:** This app provides two core utilities for producers using the custom theme:
1. **Upload Service:** Streamlined beat upload with automatic R2 storage + metafield wiring
2. **Setup Wizard:** One-time configuration of metafields, metaobjects, producers, licenses, genres

**Key Insight:** This is a **utility app**, not a standalone business platform. Sales, analytics, and product management live in Shopify's native admin. Our app bridges the gap between file upload and theme integration.

---

## Navigation Structure

### Primary Navigation (3 Items)

```
🎵 Producer Launchpad (app name → /app homepage)
   ├── 📤 Upload
   ├── ⚙️  Settings
   └── ❓ Support
```

**Rationale:**
- ✅ Under Shopify's 7-item limit
- ✅ All nouns (follows Shopify pattern)
- ✅ Focused on core utilities
- ✅ No fake features or empty pages

---

## Page Hierarchy

### Level 1: Primary Pages (In Nav)

**1. Home (`/app`)**
- Purpose: Entry point, quick access to upload
- Content: Setup status, upload CTA, feature request link

**2. Upload (`/app/upload`)**
- Purpose: Beat upload with storage + metafield wiring
- Content: Existing functional upload form
- Status: ✅ Keep as-is (already works)

**3. Settings (`/app/settings`)**
- Purpose: Consolidated configuration
- Sections: Setup status, Storage config
- Replaces: Separate Setup + Storage Settings pages

**4. Support (`/app/support`)**
- Purpose: Help, docs, feedback
- Content: Documentation, contact form, feature requests

---

### Level 2: Contextual Pages (Not In Nav)

**Setup Wizard (`/app/setup`)**
- Access: From homepage banner when setup incomplete
- Access: From Settings page "Re-run Setup" button
- Redirects: To `/app` after completion

---

## Wireframes

### 1. Home Page (`/app`)

**Setup Incomplete State:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Producer Launchpad                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [i] Setup incomplete - Configure your store to enable uploads          │ │
│  │                                                                         │ │
│  │     [Complete Setup] (primary) → /app/setup                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Upload Beats                                                           │ │
│  │                                                                         │ │
│  │ Upload your beats with automatic storage and metafield configuration   │ │
│  │ for your theme.                                                        │ │
│  │                                                                         │ │
│  │ [+ Upload Beat] (primary - disabled until setup complete)              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Feature Requests                                                       │ │
│  │                                                                         │ │
│  │ Have a feature request or feedback?                                   │ │
│  │                                                                         │ │
│  │ [Submit Request] (secondary) → /app/support                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Need help? [Contact Support] → /app/support                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Setup Complete State:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Producer Launchpad                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Upload Beats                                                           │ │
│  │                                                                         │ │
│  │ Upload your beats with automatic storage and metafield configuration   │ │
│  │ for your theme.                                                        │ │
│  │                                                                         │ │
│  │ [+ Upload Beat] (primary) → /app/upload                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Coming Soon: License Delivery                                          │ │
│  │                                                                         │ │
│  │ Automatic license file delivery to customers after purchase.          │ │
│  │ This feature is in development.                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Feature Requests                                                       │ │
│  │                                                                         │ │
│  │ Have a feature request or feedback?                                   │ │
│  │                                                                         │ │
│  │ [Submit Request] (secondary) → /app/support                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Need help? [Contact Support] → /app/support                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Components:**
- Banner (setup incomplete - conditional)
- Card (Upload CTA)
- Card (Coming Soon - conditional, shown when setup complete)
- Card (Feature Requests)
- Footer link (Support)

---

### 2. Upload Page (`/app/upload`)

**Keep existing functional page as-is.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Upload Beat              [Save Draft] (secondary)  [Upload Beat] (primary)  │
│ < Back to Home                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Beat Details                                                           │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ Beat Title *         [_____________________________________]           │ │
│  │ BPM *                [___]      Key * [________ ▾]                     │ │
│  │ Genres *             [☐ Trap  ☐ Hip Hop  ☐ R&B  ☐ Drill ...]        │ │
│  │ Producers *          [☐ Producer 1  ☐ Producer 2 ...]                │ │
│  │ Producer Alias       [_____________________________________]           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Files                                                                  │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ Preview Audio *      [Choose file...]                                 │ │
│  │ Cover Art            [Choose file...]                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ License File Assignment                                                │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ Uploaded Files:                                                        │ │
│  │   • beat.mp3    (Basic, Premium, Unlimited)                           │ │
│  │   • beat.wav    (Premium, Unlimited)                                  │ │
│  │   • stems.zip   (Unlimited)                                           │ │
│  │                                                                         │ │
│  │ [+ Add Files]                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Status:** ✅ Already functional - no changes needed

---

### 3. Settings Page (`/app/settings`)

**Consolidated Setup + Storage:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Settings                                              [Save Changes] (save)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┬───────────────────────────────────────────────────┐  │
│  │ Setup            │ Configuration Status:                             │  │
│  │                  │                                                   │  │
│  │ Initial store    │ Metafields:    ✓ Configured (10 product, 1 var)  │  │
│  │ configuration    │ Metaobjects:   ✓ Configured (3 types)            │  │
│  │ for theme        │ Producers:     ✓ 2 created                       │  │
│  │ integration.     │ Licenses:      ✓ 3 configured                    │  │
│  │                  │ Genres:        ✓ 6 configured                    │  │
│  │                  │                                                   │  │
│  │                  │ Last Setup: March 10, 2026                        │  │
│  │                  │                                                   │  │
│  │                  │ [Re-run Setup Wizard] (secondary) → /app/setup   │  │
│  │                  │                                                   │  │
│  ├──────────────────┼───────────────────────────────────────────────────┤  │
│  │ File Storage     │ Storage Provider *                                │  │
│  │                  │                                                   │  │
│  │ Configure where  │ ⦿ Managed R2 (Recommended)                        │  │
│  │ beat files are   │   ✓ Connected and ready                          │  │
│  │ stored.          │                                                   │  │
│  │                  │ ○ Self-Managed R2                                 │  │
│  │                  │   Account ID: [_________________]                 │  │
│  │                  │   Access Key: [_________________]                 │  │
│  │                  │   Secret Key: [_________________]                 │  │
│  │                  │   Bucket Name: [_________________]                │  │
│  │                  │                                                   │  │
│  │                  │ [Test Connection] (secondary)                     │  │
│  │                  │                                                   │  │
│  └──────────────────┴───────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Layout:** Settings pattern (thin left column for labels, wide right for content)

**Sections:**
1. Setup - Status checks + re-run button
2. Storage - Storage provider selection + credentials

---

### 4. Support Page (`/app/support`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Help & Support                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 📚 Documentation                                                       │ │
│  │                                                                         │ │
│  │ Learn how to upload beats, configure storage, and integrate with      │ │
│  │ your custom theme.                                                     │ │
│  │                                                                         │ │
│  │ [View Documentation] → (external docs or modal)                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ❓ Frequently Asked Questions                                          │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ ▸ How do I upload my first beat?                                      │ │
│  │ ▸ What file formats are supported?                                    │ │
│  │ ▸ How does storage work?                                              │ │
│  │ ▸ Where are my uploaded beats stored?                                 │ │
│  │ ▸ How do I configure metafields?                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 💬 Contact & Feature Requests                                          │ │
│  │                                                                         │ │
│  │ Have a question, bug report, or feature request?                      │ │
│  │                                                                         │ │
│  │ Email: [________________]                                              │ │
│  │ Message:                                                               │ │
│  │ [_________________________________________________________________]    │ │
│  │ [_________________________________________________________________]    │ │
│  │ [_________________________________________________________________]    │ │
│  │                                                                         │ │
│  │ [Submit] (primary)                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. Documentation links
2. FAQ (collapsible)
3. Contact/feature request form

---

### 5. Setup Wizard (`/app/setup`)

**Not in nav - accessed contextually:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Setup Wizard                                            [Skip] [Next Step]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Progress: ▓▓▓▓▓▓░░░░ 60%                                                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Step 3: Create Producers                                               │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │ Add at least one producer to assign to your beats.                    │ │
│  │                                                                         │ │
│  │ Producer 1:                                                            │ │
│  │   Name: [PRODBYRICH_________________]                                 │ │
│  │   Bio:  [Optional description______]                                  │ │
│  │   [Remove]                                                             │ │
│  │                                                                         │ │
│  │ [+ Add Another Producer]                                               │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [< Back]                                            [Next Step: Licenses >]│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Steps:**
1. Metafield definitions
2. Metaobject definitions
3. Create producers
4. Configure licenses
5. Seed genres
6. Test connection

**After completion:** Redirect to `/app` (Home)

---

## Routing Structure

```
/app                    → Home page (dashboard)
/app/upload             → Upload beat form
/app/settings           → Settings (Setup + Storage)
/app/support            → Help & support
/app/setup              → Setup wizard (contextual, not in nav)
```

**Redirects (deprecated routes):**
```
/app/dashboard          → /app (301 redirect)
/app/storage            → /app/settings (301 redirect)
/app/licenses           → /app/settings (301 redirect)
/app/uploaded           → /app (301 redirect - feature removed)
```

---

## Navigation Flow Diagram

```
                    ┌──────────────┐
         ┌──────────│     HOME     │──────────┐
         │          │    (/app)    │          │
         │          └──────┬───────┘          │
         │                 │                  │
         │     ┌───────────┼────────┐         │
         │     │           │        │         │
    ┌────▼─────▼──┐   ┌───▼────┐  │    ┌────▼─────┐
    │   UPLOAD    │   │SETTINGS│  │    │ SUPPORT  │
    │  (/upload)  │   │        │  │    │(/support)│
    └─────────────┘   └───┬────┘  │    └──────────┘
                          │       │
                     ┌────▼───┐   │
                     │ SETUP  │◄──┘
                     │(/setup)│ (banner CTA)
                     └────────┘
```

---

## Information Hierarchy

### Level 1: Primary Navigation
```
Home
├── Upload
├── Settings
└── Support
```

### Level 2: Page Sections
```
Home
├── Setup status banner (conditional)
├── Upload CTA card
├── Coming Soon card (conditional)
├── Feature request card
└── Support footer

Settings
├── Setup section
└── Storage section

Support
├── Documentation
├── FAQ
└── Contact form
```

### Level 3: Actions
```
Home → [Upload Beat], [Complete Setup], [Submit Request]
Upload → [Upload Beat], [Save Draft]
Settings → [Save Changes], [Re-run Setup], [Test Connection]
Support → [Submit]
```

---

## Content Strategy

### Homepage Messaging

**Setup Incomplete:**
> "Setup incomplete - Configure your store to enable uploads"

**Upload Card:**
> "Upload your beats with automatic storage and metafield configuration for your theme."

**Coming Soon (when setup complete):**
> "Coming Soon: License Delivery  
> Automatic license file delivery to customers after purchase. This feature is in development."

**Feature Requests:**
> "Have a feature request or feedback?"

**No Fake Value:**
- ❌ No fake "Total Uploads" stats
- ❌ No fake "Sales Dashboard"
- ❌ No pretending to track analytics
- ✅ Honest about what the app does
- ✅ Clear about future features

---

## Shopify Pattern Compliance

| Pattern | Requirement | Implementation | Status |
|---------|-------------|----------------|--------|
| Nav items | ≤ 7 items | 3 items (Upload, Settings, Support) | ✅ |
| Homepage duplicate | Don't duplicate app URL in nav | App name → `/app` | ✅ |
| Label style | Nouns, not verbs | "Upload", "Settings", "Support" | ✅ |
| Homepage value | Provide daily value | Upload CTA + feature roadmap | ✅ |
| Single purpose | One purpose per page | Each page focused | ✅ |
| Breadcrumbs | Enable back navigation | "< Back to Home" on Upload | ✅ |
| Action labels | {verb}+{noun} format | "Upload Beat", "Submit Request" | ✅ |
| Stay in admin | No external links for key actions | All routes embedded | ✅ |

---

## Implementation Phases

### Phase 1: Homepage (Priority 1)
**Goal:** Replace blocked dashboard with honest, functional homepage

**Tasks:**
1. Create `/app/_index.tsx` with new homepage layout
2. Add setup status check (conditional banner)
3. Add Upload CTA card
4. Add Feature Request card
5. Add Support footer link
6. Remove blocked "Unable to load dashboard" state

**Files to modify:**
- `app/routes/app._index.tsx` (complete rewrite)

**Acceptance criteria:**
- [ ] Homepage loads without errors
- [ ] Setup banner shows when setup incomplete
- [ ] Upload button disabled until setup complete
- [ ] Upload button enabled and links to `/app/upload` when setup complete
- [ ] Feature request button links to `/app/support`
- [ ] No fake stats or empty data tables

---

### Phase 2: Settings Consolidation (Priority 2)
**Goal:** Merge Setup + Storage into one Settings page

**Tasks:**
1. Create `/app/settings.tsx` route
2. Move Setup status/re-run from `/app/setup.tsx`
3. Move Storage config from `/app/storage.tsx`
4. Use Settings layout pattern (thin left, wide right)
5. Add redirects from old routes

**Files to modify:**
- Create: `app/routes/app.settings.tsx` (new)
- Update: `app/routes/app.setup.tsx` (make contextual only)
- Update: `app/routes/app.storage.tsx` (redirect to Settings)

**Acceptance criteria:**
- [ ] Settings page loads with both sections
- [ ] Setup section shows status + re-run button
- [ ] Storage section shows provider selection + credentials
- [ ] Save Changes button works
- [ ] Re-run Setup button links to `/app/setup`
- [ ] Old routes redirect correctly

---

### Phase 3: Support Page (Priority 3)
**Goal:** Add basic support/help page

**Tasks:**
1. Create `/app/support.tsx` route
2. Add documentation section (links or content)
3. Add FAQ section (collapsible)
4. Add contact/feature request form
5. Wire up form submission

**Files to create:**
- `app/routes/app.support.tsx` (new)

**Acceptance criteria:**
- [ ] Support page loads
- [ ] FAQ items are collapsible
- [ ] Contact form submits successfully
- [ ] Form sends email or saves to database
- [ ] Confirmation message shows after submission

---

### Phase 4: Navigation Update (Priority 4)
**Goal:** Update app nav to reflect new structure

**Tasks:**
1. Update AppNav component to 3 items
2. Remove old nav items (Dashboard, Licenses, Uploaded)
3. Add Upload, Settings, Support
4. Test active states

**Files to modify:**
- `app/components/AppNav.tsx` (or wherever nav is defined)

**Acceptance criteria:**
- [ ] Nav shows 3 items (Upload, Settings, Support)
- [ ] Active state highlights correct item
- [ ] App name links to `/app`
- [ ] No duplicate homepage URL in nav

---

## Success Metrics

**Functional Goals:**
- ✅ Homepage loads without errors
- ✅ Upload flow remains functional
- ✅ Setup wizard accessible when needed
- ✅ Settings consolidated and clear
- ✅ Support page provides help

**User Experience Goals:**
- ✅ New users understand app purpose immediately
- ✅ Setup process is discoverable
- ✅ No confusion about missing features
- ✅ Clear path to upload beats
- ✅ Honest about MVP scope

**Pattern Compliance:**
- ✅ All Shopify navigation patterns followed
- ✅ No fake dashboards or misleading stats
- ✅ Polaris components used correctly

---

## Future Roadmap (Not MVP)

### Post-MVP Features
1. **License Delivery** - Automatic file delivery after purchase
2. **Beats Management** - View/edit uploaded beats (optional)
3. **Subscription** - Pricing tiers (if needed)
4. **Analytics** - Upload trends, storage usage (basic)

### When to Add "Beats" Page
**Trigger:** When we add beat editing/management features

**Until then:** Products managed in Shopify admin (native experience)

---

## References

- [Shopify App Design Skill](./skills/shopify-app-design/SKILL.md)
- [Home Page Patterns](./skills/shopify-app-design/patterns/home-page.md)
- [Navigation Patterns](./skills/shopify-app-design/patterns/navigation.md)
- [Page Design Patterns](./skills/shopify-app-design/patterns/page-design.md)
- [Shopify Navigation Guidelines](https://shopify.dev/docs/apps/design/navigation)
- [Shopify App Home Page](https://shopify.dev/docs/apps/design/user-experience/app-home-page)

---

**Status:** Ready for implementation  
**Next Step:** Phase 1 - Build new homepage
