# Navigation Patterns

**Source:** [Shopify Navigation Guidelines](https://shopify.dev/docs/apps/design/navigation)

---

## Purpose

Navigation enables merchants to move between sections of your app. Good navigation:
- Shows merchants where they currently are
- Makes it obvious how to reach other sections
- Enables task completion easily and without friction
- Should be built around what merchants need to do

---

## Information Architecture (IA)

###

 Why IA Matters
- Shows merchants where they are and how to navigate the rest of the app
- Should make it obvious what previously happened and what will happen next
- Use relationship between app nav and app body to guide merchants

---

## ✅ DO

### App Home URL
- ✅ **Point app URL to homepage** — Set in Dev Dashboard under App > Versions > App URL
- ✅ **Use app name to navigate home** — Clicking app name should return to homepage
- ✅ **Provide default homepage** — Even for extension-only apps, Shopify provides one

### Navigation Structure
- ✅ **Use fewest possible categories** — Simplify what your app does into clear sections
- ✅ **Enable back navigation** — Provide breadcrumbs or Back button (don't rely on browser button)
- ✅ **Keep merchants in Shopify admin** — Don't send outside admin for key actions or primary workflows
- ✅ **Make navigation items short and scannable** — Use nouns instead of verbs
- ✅ **Keep app name under 20 characters** — Names beyond 20 characters will be truncated

### App Nav
- ✅ **Use app nav for primary navigation** — Located in sidebar (desktop) or header (mobile)
- ✅ **Limit to 7 items max** — Items 7+ are truncated into "View more" button
- ✅ **Use tabs sparingly for secondary navigation** — Only when app nav isn't sufficient
- ✅ **Make tabs single-line** — Never wrap tabs onto multiple lines
- ✅ **Ensure tab clicks only change content below** — Not above the tabs

### Page Structure
- ✅ **Use short, descriptive page titles** — Clearly state the page's general purpose
- ✅ **Limit each page to single purpose** — Helps merchants focus attention
- ✅ **Use {verb}+{noun} format for actions** — e.g., "Upload Beat" not "Upload"
- ✅ **Make actions clear and predictable** — Merchants should anticipate what happens on click

### Navigation Icon
- ✅ **Make SVG similar to App Store icon** — Visual consistency
- ✅ **Submit icon without rounded corners** — Shopify crops with 4px border radius
- ✅ **Use gray for inactive, green for active** — Follows Shopify admin conventions

---

## ❌ DON'T

### Structure Mistakes
- ❌ **Don't duplicate homepage URL in nav** — App name already points to homepage
- ❌ **Don't use more than 7 nav items** — Excess items get hidden in "View more"
- ❌ **Don't place main navigation in page header** — Reserved for in-page actions (misleads merchants)
- ❌ **Don't replicate app nav in app body** — Causes unnecessary repetition
- ❌ **Don't send merchants outside Shopify admin** — Especially for key workflows

### Content Mistakes
- ❌ **Don't use verbs for nav items** — Use nouns (e.g., "Uploads" not "Upload")
- ❌ **Don't make page titles long** — Keep concise and scannable
- ❌ **Don't split merchant attention** — One purpose per page
- ❌ **Don't use vague action labels** — "Submit" is less clear than "Upload Beat"

### Tab Mistakes
- ❌ **Don't wrap tabs onto multiple lines** — Always single line
- ❌ **Don't change tab position on navigation** — Tabs should stay stable
- ❌ **Don't use tabs as primary navigation** — Use app nav instead

---

## Navigation Areas

| Location | Purpose | Component |
|----------|---------|-----------|
| **App nav** | Primary navigation between pages | [s-app-nav](https://shopify.dev/docs/api/app-home/app-bridge-web-components/s-app-nav) |
| **App header** | Page title + page-specific actions | [Page / TitleBar](https://shopify.dev/docs/api/app-home/app-bridge-web-components/title-bar) |
| **Page title** | Describes current page purpose | Part of Page component |
| **Overflow menu** | Support links ("About this app", "Support") | Auto-included, not customizable |

---

## Code Examples

### App Nav Structure
```jsx
<AppNav>
  {/* Don't duplicate homepage URL */}
  {/* <NavItem label="Home" destination="/" /> ❌ */}
  
  <NavItem label="Beats" destination="/beats" />
  <NavItem label="Settings" destination="/settings" />
  <NavItem label="Support" destination="/support" />
</AppNav>
```

### Page Header with Actions
```tsx
<Page
  title="Upload Beat"  // Short, descriptive
  primaryAction={{
    content: "Upload Beat",  // {verb}+{noun}
    onAction: handleUpload
  }}
  secondaryActions={[{
    content: "Save Draft",
    onAction: handleDraft
  }]}
>
  {/* Page content */}
</Page>
```

### Breadcrumb Navigation
```tsx
<Page
  title="Edit Beat"
  breadcrumbs={[
    { content: "Beats", url: "/beats" }
  ]}
>
  {/* Don't rely on browser back button */}
</Page>
```

---

## Polaris Components Reference

| Component | Use Case | Docs |
|-----------|----------|------|
| **AppNav** | Primary navigation sidebar | [App Nav](https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav) |
| **Page** | Page structure with title & actions | [Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |
| **Tabs** | Secondary navigation (use sparingly) | [Tabs](https://shopify.dev/docs/api/app-home/polaris-web-components/navigation/tabs) |

---

## Key Takeaways

1. **App name = homepage** — Don't duplicate in nav
2. **7 items max** — More gets hidden
3. **Nouns, not verbs** — "Beats" not "Upload"
4. **One purpose per page** — Focus merchant attention
5. **Stay in Shopify admin** — Don't link externally for key actions
