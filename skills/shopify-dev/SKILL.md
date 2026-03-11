# Shopify Dev Skill

## Purpose

This skill provides curated best practices from official Shopify documentation for building embedded Shopify apps. Use these patterns when designing information architecture, navigation, layouts, and billing for the Producer Launchpad app.

---

## Pattern Files

All patterns extracted from official Shopify App Design Guidelines.

### 📄 [Home Page Patterns](./patterns/home-page.md)

**When to use:** Designing the app's landing page / dashboard

**Key concepts:**
- Provide daily value to merchants
- Status updates + clear CTAs
- Support placement strategies
- Single vs multi-column layouts for homepage

**Source:** [App Home Page Guidelines](https://shopify.dev/docs/apps/design/user-experience/app-home-page)

---

### 📄 [Navigation Patterns](./patterns/navigation.md)

**When to use:** Structuring app navigation and information architecture

**Key concepts:**
- App nav (max 7 items)
- App home URL rules (don't duplicate in nav)
- Page titles and breadcrumbs
- Primary/secondary actions
- {verb}+{noun} action labels

**Source:** [Navigation Guidelines](https://shopify.dev/docs/apps/design/navigation)

---

### 📄 [Page Design Patterns](./patterns/page-design.md)

**When to use:** Laying out individual pages and choosing appropriate layouts

**Key concepts:**
- Single-column (focused tasks)
- Two-column (visual editors)
- Settings layout (configuration)
- 4px spacing grid
- Information density
- Containers and sections
- Table design

**Sources:**
- [Layout](https://shopify.dev/docs/apps/design/layout)
- [Visual Design](https://shopify.dev/docs/apps/design/visual-design)
- [Content](https://shopify.dev/docs/apps/design/content)

---

### 📄 [Billing Patterns](./patterns/billing.md)

**When to use:** Implementing subscriptions, pricing tiers, or one-time purchases

**Key concepts:**
- Subscription models (time-based, usage-based, combo)
- One-time purchases
- Price adjustments (credits, discounts, trials, refunds)
- Best practices (2-3 plans max, free trials, local currency)
- Gating routes
- React Router billing utilities

**Source:** [App Billing](https://shopify.dev/docs/apps/launch/billing)

---

## How to Use This Skill

### Step 1: Identify Your Task

| Task | Pattern File |
|------|--------------|
| Designing app homepage | [home-page.md](./patterns/home-page.md) |
| Structuring navigation | [navigation.md](./patterns/navigation.md) |
| Laying out a page | [page-design.md](./patterns/page-design.md) |
| Implementing billing | [billing.md](./patterns/billing.md) |

### Step 2: Read DOs and DON'Ts

Each pattern file contains:
- ✅ **DO** — Recommended approaches with examples
- ❌ **DON'T** — Common mistakes to avoid
- **Code examples** — Polaris component usage
- **References** — Links to official docs

### Step 3: Apply to Producer Launchpad

When designing or reviewing app features, reference the appropriate pattern file and ensure compliance with Shopify guidelines.

---

## Quick Reference: Common Questions

### "How many navigation items should I have?"
**Answer:** Max 7 items. Beyond that, items get truncated into "View more."  
**Pattern:** [navigation.md](./patterns/navigation.md)

### "Should I duplicate the homepage in my nav?"
**Answer:** No. App name already points to homepage.  
**Pattern:** [navigation.md](./patterns/navigation.md)

### "How many pricing plans should I offer?"
**Answer:** 2-3 plans max. Too many = confusion.  
**Pattern:** [billing.md](./patterns/billing.md)

### "Where should support links go?"
**Answer:** App nav, page footer, or floating action button. Be consistent.  
**Pattern:** [home-page.md](./patterns/home-page.md)

### "Can I use primary buttons in tables?"
**Answer:** No. Use secondary actions (text buttons, icons, dropdowns).  
**Pattern:** [page-design.md](./patterns/page-design.md)

### "What spacing grid should I use?"
**Answer:** 4px spacing grid (4, 8, 12, 16, 20, etc.). Use Polaris Stack components.  
**Pattern:** [page-design.md](./patterns/page-design.md)

---

## Related Shopify Documentation

- [App Design Guidelines](https://shopify.dev/docs/apps/design)
- [Polaris Component Library](https://shopify.dev/docs/api/app-home/polaris-web-components)
- [App Bridge](https://shopify.dev/docs/api/app-bridge)
- [Billing API](https://shopify.dev/docs/api/admin-graphql/latest/mutations/appSubscriptionCreate)

---

## Pattern File Structure

Each pattern file follows this structure:

```markdown
# Pattern Name

**Source:** [Link to official docs]

## Purpose
Brief description of what this pattern addresses

## ✅ DO
Recommended approaches with:
- Explanations
- Code examples
- Component references

## ❌ DON'T
Common mistakes to avoid with:
- Anti-patterns
- Reasons why to avoid

## Polaris Components Reference
Table of relevant components

## Key Takeaways
Quick summary of most important rules
```

---

## Maintenance

**Last updated:** March 11, 2026  
**Shopify docs version:** Current as of fetch date

When Shopify updates their guidelines, re-fetch documentation and update pattern files accordingly.

---

## Usage in Producer Launchpad App

This skill is specifically designed for the Producer Launchpad app (beat marketplace for producers). Apply these patterns when:

- Designing new pages
- Refactoring existing pages
- Implementing navigation changes
- Adding billing/subscription features
- Reviewing PR code for compliance

**Key Producer Launchpad pages that should follow patterns:**
- Homepage/Dashboard → [home-page.md](./patterns/home-page.md)
- Beat upload flow → [page-design.md](./patterns/page-design.md)
- Settings → [page-design.md](./patterns/page-design.md)
- Subscription/billing → [billing.md](./patterns/billing.md)
- App navigation → [navigation.md](./patterns/navigation.md)
