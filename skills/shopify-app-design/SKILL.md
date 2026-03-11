---
name: shopify-app-design
description: Design Shopify embedded apps using Polaris React correctly. Use when building UI for Shopify apps, choosing layout patterns, deciding which Polaris components to use, reviewing designs for Shopify-native compliance, or asking "does this look Shopify native?", "how should I lay this out?", "which Polaris component should I use?", "why does my UI look custom/un-Shopify?".
user-invocable: true
allowed-tools: Read, Edit, Write
---

# Shopify App Design — Polaris React

**Core rule:** Use Polaris exclusively. No custom colors, shadows, borders, or typography. The app must look indistinguishable from Shopify Admin.

## When to Use

✅ USE when:
- Building or reviewing any embedded Shopify app UI
- Choosing between layout options (single-col, two-col, settings)
- Picking Polaris components for a new pattern (upload, table, navigation)
- A design "looks cool but not Shopify native" — needs a compliance pass
- Debugging TypeScript errors from incorrect Polaris prop usage

❌ DON'T USE when:
- Building a storefront theme (different design system)
- Building a standalone web app outside Shopify Admin

---

## Layout Decision Tree

```
What type of page is this?
├─ Homepage / simple list → Single-column (Page + Layout.Section)
├─ Resource editor (like Add Product) → Two-column
│   ├─ Left (2/3): main content cards stacked
│   └─ Right (1/3): Status + Organization cards
├─ Settings page → Settings layout
│   ├─ Left: narrow label + description
│   └─ Right: form elements
└─ Complex editor / preview → App window (full-screen)
```

**Two-column in Polaris:**
```tsx
<Layout>
  <Layout.Section>{/* main content */}</Layout.Section>
  <Layout.Section variant="oneThird">{/* sidebar */}</Layout.Section>
</Layout>
```

---

## Card Rules (memorize these)

| Rule | Correct | Wrong |
|---|---|---|
| Primary actions per card | Max 1 | Multiple primary buttons |
| Table/list actions | `variant="plain"` or icon | `variant="primary"` |
| Remove/delete buttons | `variant="plain"` | `variant="primary" tone="critical"` |
| Card header pattern | `Box padding="400" borderBlockEndWidth="025" borderColor="border"` | Custom `<div>` with inline styles |
| Text on background | Always in a container | Directly on `bg-surface` |
| Separators | `<Divider />` | `<hr>` or custom borders |

---

## Color Semantics — Never Deviate

| Color | Use for | Never use for |
|---|---|---|
| success (green) | Positive status, completion | General decoration |
| attention (yellow) | Paused, incomplete, non-urgent | Required field indicators |
| caution (orange) | Pending, in-progress, needs attention | Errors |
| critical (red) | Errors, blocked actions | Warnings |
| magic (purple) | Preview/media type chips | General decoration |

**Required fields:** Use inline subdued text `(required)` — never `<Badge tone="attention">Required</Badge>`

---

## Content & Copy Rules

- **Sentence case** for all headings: "Preview audio" not "Preview Audio"
- **Grade 7 reading level** — short sentences, no idioms
- **CTAs:** verb + noun — "Add files", "Create beat product", "Save product"
- **One term per concept** — never use synonyms for the same thing across a page
- Don't over-explain; don't under-explain — enough to make the right decision

---

## Known TypeScript Gotchas

```
Box as="th" / as="td" / as="button"  → INVALID — use raw HTML + CSS vars
borderColor="border-interactive"      → INVALID — use style={{ borderColor: 'var(--p-color-border-interactive)' }}
Text tone="info"                      → INVALID — valid tones: subdued, success, critical, caution, magic, disabled
Icon tone="info"                      → VALID for Icon, not for Text
Badge tone="attention"                → valid tone but wrong for required indicators
```

---

---

## Pattern Library

### Component Patterns (Tactical)
For copy-paste patterns covering:
- File rows, file upload states, cover art image slots
- File type chips (icon + label with correct bg tokens)
- Left-rail navigation (variant/license panels)
- Variant tables with CSS variables
- DropZone empty vs filled states

→ See [patterns/component-patterns.md](patterns/component-patterns.md)

### Strategic Patterns (Architecture)

#### Home Page Patterns
When to use: Designing app homepage/dashboard  
Key concepts: Daily value, status updates, CTAs, support placement  
→ See [patterns/home-page.md](patterns/home-page.md)

#### Navigation Patterns
When to use: Structuring app navigation and IA  
Key concepts: Max 7 nav items, no homepage duplicate, breadcrumbs, action labels  
→ See [patterns/navigation.md](patterns/navigation.md)

#### Page Design Patterns
When to use: Choosing layouts and structuring pages  
Key concepts: Single/two-column layouts, 4px grid, density, containers  
→ See [patterns/page-design.md](patterns/page-design.md)

#### Billing Patterns
When to use: Implementing subscriptions or pricing  
Key concepts: Subscription models, gating, trials, best practices  
→ See [patterns/billing.md](patterns/billing.md)
