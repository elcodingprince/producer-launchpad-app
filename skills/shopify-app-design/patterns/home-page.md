# Home Page Patterns

**Source:** [Shopify App Home Page Guidelines](https://shopify.dev/docs/apps/design/user-experience/app-home-page)

---

## Purpose

A good home page should:
- Provide status updates
- Enable merchants to respond to immediate needs
- Provide clear call-to-action (CTA) buttons so merchants can easily see actions they can perform

---

## ✅ DO

### Content & Structure
- ✅ **Provide daily value** — The home page is the first page merchants see; make it immediately useful
- ✅ **Answer merchant questions quickly** — Design to quickly address "What can I do?" and "What's happening?"
- ✅ **Show status updates** — Display relevant metrics, alerts, or notifications
- ✅ **Enable immediate action** — Provide clear CTAs for common tasks
- ✅ **Include quick statistics** — Show immediately actionable information (e.g., "This week's performance")

### Support & Help
- ✅ **Place support CTAs consistently** — Use predictable, discoverable locations
- ✅ **Be responsive** — Reply to merchant questions quickly
- ✅ **Use Polaris App nav** — Place support links in navigation
- ✅ **Use page footers** — Alternative location for support links
- ✅ **Consider floating action button** — For persistent support access

**Example locations for support:**
```jsx
// Option 1: App nav item
<AppNav>
  <NavItem label="Support" destination="/support" />
</AppNav>

// Option 2: Footer link
<Page>
  <Footer>
    <Link url="/support">Contact Support</Link>
  </Footer>
</Page>

// Option 3: Floating action button (out of merchants' way but discoverable)
```

### Layout
- ✅ **Use single-column for focus** — When homepage has one primary task
- ✅ **Use two/three-column for dashboards** — When showing multiple metrics/stats
- ✅ **Make CTAs obvious** — Use primary button styling for main actions
- ✅ **Use dismissible banners** — For time-sensitive information (e.g., "USPS rate changes")
- ✅ **Show graphs/charts** — For performance data when relevant

---

## ❌ DON'T

### Content Mistakes
- ❌ **Don't bury primary actions** — Keep the most important CTA above the fold
- ❌ **Don't overload with information** — Focus on immediate value, not everything the app can do
- ❌ **Don't hide support** — Merchants should always know how to get help
- ❌ **Don't use vague CTAs** — "Get Started" is less clear than "Upload Image"

### Layout Mistakes
- ❌ **Don't make merchants scroll for main action** — Primary task should be visible immediately
- ❌ **Don't clutter with irrelevant data** — Only show metrics that drive action
- ❌ **Don't use inconsistent support placement** — Pick one location and stick to it across the app

---

## Reference: Polaris Components

| Component | Use Case | Docs |
|-----------|----------|------|
| **Page** | Main container for homepage content | [Polaris Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |
| **Card** | Container for sections with CTAs | [Polaris Card](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/card) |
| **Banner** | Dismissible informational messages | [Polaris Banner](https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-indicators/banner) |
| **Button** | Primary and secondary actions | [Polaris Button](https://shopify.dev/docs/api/app-home/polaris-web-components/actions/button) |
| **AppNav** | Persistent navigation with support link | [Polaris AppNav](https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav) |

---

## Example Homepage Structure

```tsx
<Page title="Dashboard">
  {/* Time-sensitive info */}
  <Banner tone="info" onDismiss={handleDismiss}>
    USPS rate changes effective March 15th
  </Banner>

  {/* Primary action card */}
  <Card>
    <BlockStack gap="400">
      <Text variant="headingMd">Upload Your First Beat</Text>
      <Text>Start selling by uploading your beat and setting license tiers.</Text>
      <Button variant="primary" onClick={goToUpload}>Upload Beat</Button>
    </BlockStack>
  </Card>

  {/* Stats section */}
  <Card>
    <BlockStack gap="400">
      <Text variant="headingMd">This Week's Performance</Text>
      {/* Charts/graphs here */}
    </BlockStack>
  </Card>
</Page>
```

---

## Homepage Pattern Reference

See [Shopify Homepage Pattern](https://shopify.dev/docs/api/app-home/patterns/templates/homepage) for official template guidance.
