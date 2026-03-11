# Navigation Specification
**Producer Launchpad App**

**Pattern Reference:** [Navigation Patterns](./skills/shopify-app-design/patterns/navigation.md)

---

## Navigation Structure

Following Shopify patterns:
- ✅ Max 7 items (we use 3)
- ✅ App name → homepage (no duplicate)
- ✅ Short, scannable nouns
- ✅ Workflow-based organization

```
Producer Launchpad (app name) → /app (homepage)
├── Beats → /app/beats
├── Settings → /app/settings
└── Support → /app/support
```

---

## App Name

**Display:** "Producer Launchpad"  
**Character count:** 17 (under 20-char limit ✅)  
**Destination:** `/app` (homepage)

**Configuration:** Set in Dev Dashboard:
- App > Versions > Create a version > App URL

**Pattern compliance:**
- ✅ Under 20 characters
- ✅ Points to homepage
- ✅ Not duplicated in nav items

---

## Navigation Items

### 1. Beats

**Label:** "Beats"  
**Route:** `/app/beats`  
**Purpose:** View and manage uploaded beats

**Active states:**
- `/app/beats` (list page)
- `/app/beats/:id` (detail/edit)
- `/app/beats/new` (upload - though accessed via CTA, not nav breadcrumb)

**Icon:** Optional (SoundIcon or similar)

**Pattern compliance:**
- ✅ Noun, not verb
- ✅ Short and scannable
- ✅ Primary resource

---

### 2. Settings

**Label:** "Settings"  
**Route:** `/app/settings`  
**Purpose:** App configuration (storage, preferences)

**Active states:**
- `/app/settings` (settings page)
- `/app/settings/:section` (if we add section-based routing later)

**Pattern compliance:**
- ✅ Noun
- ✅ Standard settings page pattern

---

### 3. Support

**Label:** "Support"  
**Route:** `/app/support`  
**Purpose:** Help, docs, contact

**Active states:**
- `/app/support`

**Pattern compliance:**
- ✅ Consistent placement
- ✅ Discoverable

---

## Pages NOT in Navigation

### Setup (`/app/setup`)

**Why not in nav:** 
- Contextual page accessed from homepage banner when setup incomplete
- Not part of regular workflow after onboarding

**Access points:**
- Homepage banner (when setup incomplete)
- Settings page ("Re-run setup" link)

---

### Upload (`/app/beats/new`)

**Why not in nav:**
- Secondary action accessed via primary CTAs
- Follows pattern: main pages in nav, actions via buttons

**Access points:**
- Homepage: "Upload Beat" primary button
- Beats page: "Upload Beat" primary action button
- Breadcrumbs: "Beats > Upload Beat"

---

## Code Implementation

### App Nav Component

```tsx
// app/components/AppNav.tsx (or in app root layout)
import { AppNav, NavItem } from "@shopify/polaris";

export function AppNavigation() {
  return (
    <AppNav>
      {/* NO homepage item - app name handles this */}
      <NavItem
        label="Beats"
        destination="/app/beats"
        icon={SoundIcon}
      />
      <NavItem
        label="Settings"
        destination="/app/settings"
        icon={SettingsIcon}
      />
      <NavItem
        label="Support"
        destination="/app/support"
        icon={QuestionMarkIcon}
      />
    </AppNav>
  );
}
```

---

## Breadcrumb Patterns

Following Shopify pattern: enable back navigation without browser button.

### Homepage
```tsx
<Page title="Dashboard">
  {/* No breadcrumbs */}
</Page>
```

### Beats List
```tsx
<Page title="Beats">
  {/* No breadcrumbs (top-level page) */}
</Page>
```

### Upload Beat
```tsx
<Page
  title="Upload Beat"
  breadcrumbs={[{ content: "Beats", url: "/app/beats" }]}
>
  {/* Upload form */}
</Page>
```

### Beat Detail/Edit
```tsx
<Page
  title={beatTitle}
  breadcrumbs={[{ content: "Beats", url: "/app/beats" }]}
>
  {/* Beat details */}
</Page>
```

### Settings
```tsx
<Page title="Settings">
  {/* No breadcrumbs (top-level page) */}
</Page>
```

### Setup
```tsx
<Page
  title="Setup"
  breadcrumbs={[{ content: "Home", url: "/app" }]}
>
  {/* Setup wizard */}
</Page>
```

---

## Page Actions

Following pattern: `{verb}+{noun}` format for clarity and predictability.

### Homepage
```tsx
<Page title="Dashboard">
  {/* No page-level actions (actions in cards) */}
</Page>
```

### Beats List
```tsx
<Page
  title="Beats"
  primaryAction={{
    content: "Upload Beat",  // ✅ {verb}+{noun}
    url: "/app/beats/new",
    icon: PlusIcon,
  }}
>
  {/* Beats list */}
</Page>
```

### Upload Beat
```tsx
<Page
  title="Upload Beat"
  breadcrumbs={[{ content: "Beats", url: "/app/beats" }]}
  primaryAction={{
    content: "Upload Beat",  // ✅ {verb}+{noun}
    onAction: handleUpload,
    loading: isUploading,
  }}
  secondaryActions={[{
    content: "Save Draft",  // ✅ {verb}+{noun}
    onAction: handleSaveDraft,
  }]}
>
  {/* Upload form */}
</Page>
```

### Beat Detail/Edit
```tsx
<Page
  title={beatTitle}
  breadcrumbs={[{ content: "Beats", url: "/app/beats" }]}
  primaryAction={{
    content: "Save Changes",  // ✅ {verb}+{noun}
    onAction: handleSave,
  }}
  secondaryActions={[
    {
      content: "Delete Beat",  // ✅ {verb}+{noun}
      onAction: handleDelete,
      destructive: true,
    }
  ]}
>
  {/* Beat editor */}
</Page>
```

---

## Navigation Icons

**Requirements** (from Shopify pattern):
- Gray when inactive, green when active
- SVG similar to App Store icon
- Submitted without rounded corners (Shopify crops with 4px border radius)

**Configuration:** Dev Dashboard > App setup > Embedded app

**Icons for nav items:**
- Beats: SoundIcon (Polaris icon)
- Settings: SettingsIcon (Polaris icon)
- Support: QuestionMarkIcon (Polaris icon)

---

## Mobile Navigation

**Shopify handles mobile layout automatically:**
- Desktop: App nav in sidebar
- Mobile: App nav in header

**No additional mobile-specific code needed** (Polaris handles responsiveness).

---

## Overflow Menu

**Content (not customizable):**
- About this app
- Support

**Note:** On mobile, "pin app" option is collapsed into overflow menu.

---

## Routing Redirects

Handle deprecated routes:

```tsx
// app/routes/app.storage.tsx
export const loader = () => {
  return redirect("/app/settings");
};
```

```tsx
// app/routes/app.licenses.tsx
export const loader = () => {
  return redirect("/app/setup");
};
```

---

## Active State Logic

**Current route detection:**

```tsx
// In app root layout or AppNav component
import { useLocation } from "@remix-run/react";

function AppNavigation() {
  const location = useLocation();
  
  return (
    <AppNav>
      <NavItem
        label="Beats"
        destination="/app/beats"
        selected={location.pathname.startsWith("/app/beats")}
      />
      <NavItem
        label="Settings"
        destination="/app/settings"
        selected={location.pathname.startsWith("/app/settings")}
      />
      <NavItem
        label="Support"
        destination="/app/support"
        selected={location.pathname === "/app/support"}
      />
    </AppNav>
  );
}
```

---

## Navigation Patterns Compliance

| Pattern | Requirement | Implementation | Status |
|---------|-------------|----------------|--------|
| Max nav items | ≤ 7 items | 3 items | ✅ |
| Homepage duplicate | Don't duplicate homepage URL | App name → `/app` | ✅ |
| Label style | Nouns, not verbs | "Beats", "Settings", "Support" | ✅ |
| Label length | Short and scannable | All under 10 chars | ✅ |
| Back navigation | Breadcrumbs or back button | Breadcrumbs on detail pages | ✅ |
| Stay in admin | No external links for key actions | All routes embedded | ✅ |
| App name length | < 20 characters | "Producer Launchpad" = 17 | ✅ |
| Action labels | {verb}+{noun} format | "Upload Beat", "Save Changes" | ✅ |

---

## Polaris Components

| Component | Usage | Docs |
|-----------|-------|------|
| AppNav | Primary navigation | [AppNav](https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav) |
| NavItem | Individual nav links | Part of AppNav |
| Page | Page structure with breadcrumbs | [Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |

---

## Acceptance Criteria

- [ ] App name "Producer Launchpad" links to `/app`
- [ ] Nav has exactly 3 items: Beats, Settings, Support
- [ ] No duplicate homepage URL in nav
- [ ] Breadcrumbs present on detail/upload pages
- [ ] Breadcrumbs enable back navigation
- [ ] Active state highlights correct nav item
- [ ] Primary actions use {verb}+{noun} format
- [ ] No external links in primary workflows
- [ ] Deprecated routes redirect correctly (`/app/storage` → `/app/settings`, `/app/licenses` → `/app/setup`)
- [ ] Mobile navigation works automatically (Polaris handles)

---

## References

- [Navigation Patterns](./skills/shopify-app-design/patterns/navigation.md)
- [Shopify Navigation Guidelines](https://shopify.dev/docs/apps/design/navigation)
- [Polaris AppNav](https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav)
- [Polaris Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page)

---

## Implementation Notes

1. **Remove old nav items** — Kill Dashboard, Licenses, Storage from nav
2. **Keep Setup accessible** — Homepage banner + Settings page link
3. **Add redirects** — `/app/storage` → `/app/settings`, `/app/licenses` → `/app/setup`
4. **Test breadcrumb navigation** — Verify back navigation works without browser button
5. **Test active states** — Ensure correct nav item highlights on each page
6. **Verify mobile layout** — Test on mobile device (Polaris should handle automatically)
