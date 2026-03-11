# Home Page Specification
**Producer Launchpad Dashboard**

**Route:** `/app` (app homepage URL)  
**Pattern Reference:** [Home Page Patterns](./skills/shopify-dev/patterns/home-page.md)

---

## Purpose

Provide **daily value** to producers by:
- Showing setup status (if incomplete)
- Displaying quick performance stats
- Enabling immediate action (upload beat)
- Showing recent activity

---

## Layout

**Type:** Single-column  
**Width:** Default (not full-width)  
**Pattern:** [Home Page - Single Column](./skills/shopify-dev/patterns/home-page.md)

---

## Content Sections

### 1. Setup Incomplete Banner (Conditional)

**Display when:** `setupStatus.isComplete === false`

**Component:** Banner (tone: info)

**Content:**
```
Title: "Complete setup to start uploading"
Body: "Finish configuring your store to enable beat uploads."
Action: "Complete Setup" (primary button) → /app/setup
```

**Code:**
```tsx
{!setupStatus.isComplete && (
  <Layout.Section>
    <Banner
      title="Complete setup to start uploading"
      tone="info"
      action={{
        content: "Complete Setup",
        url: "/app/setup",
      }}
    >
      <p>Finish configuring your store to enable beat uploads.</p>
    </Banner>
  </Layout.Section>
)}
```

---

### 2. Quick Stats Card

**Display when:** Always (show empty state if no data)

**Component:** Card

**Content:**
- Title: "Performance Overview"
- Three stat blocks (inline):
  - **Total Beats:** `{stats.totalBeats}` beats uploaded
  - **Total Plays:** `{stats.totalPlays}` preview plays
  - **Total Sales:** `{stats.totalSales}` licenses sold

**Empty State:**
```
Total Beats: 0 beats uploaded
Total Plays: —
Total Sales: —
```

**Code:**
```tsx
<Layout.Section>
  <Card>
    <BlockStack gap="400">
      <Text variant="headingMd">Performance Overview</Text>
      <InlineStack gap="600">
        <BlockStack gap="200">
          <Text variant="headingLg">{stats.totalBeats}</Text>
          <Text tone="subdued">Beats uploaded</Text>
        </BlockStack>
        <BlockStack gap="200">
          <Text variant="headingLg">{stats.totalPlays || "—"}</Text>
          <Text tone="subdued">Preview plays</Text>
        </BlockStack>
        <BlockStack gap="200">
          <Text variant="headingLg">{stats.totalSales || "—"}</Text>
          <Text tone="subdued">Licenses sold</Text>
        </BlockStack>
      </InlineStack>
    </BlockStack>
  </Card>
</Layout.Section>
```

---

### 3. Primary Action Card (Conditional)

**Display when:** `setupStatus.isComplete === true` AND `stats.totalBeats === 0`

**Component:** Card with CTA

**Content:**
```
Title: "Upload Your First Beat"
Body: "Start selling by uploading your beat and setting license tiers."
Primary Action: "Upload Beat" → /app/beats/new
```

**Code:**
```tsx
{setupStatus.isComplete && stats.totalBeats === 0 && (
  <Layout.Section>
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd">Upload Your First Beat</Text>
        <Text>
          Start selling by uploading your beat and setting license tiers.
        </Text>
        <Button
          variant="primary"
          url="/app/beats/new"
          icon={PlusIcon}
        >
          Upload Beat
        </Button>
      </BlockStack>
    </Card>
  </Layout.Section>
)}
```

---

### 4. Recent Beats Card

**Display when:** `stats.totalBeats > 0`

**Component:** Card with ResourceList

**Content:**
- Title: "Recent Beats"
- List of last 5 beats with:
  - Cover art thumbnail
  - Beat title
  - Status badge (Published / Draft / Processing)
  - Created date
  - Action: "View" → `/app/beats/{id}`

**Empty State:** (Should never show if `totalBeats > 0`, but handle gracefully)
```
EmptyState: "No beats yet. Upload your first beat to get started."
```

**Code:**
```tsx
{stats.totalBeats > 0 && (
  <Layout.Section>
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd">Recent Beats</Text>
          <Button url="/app/beats">View all</Button>
        </InlineStack>
        
        <ResourceList
          resourceName={{ singular: "beat", plural: "beats" }}
          items={recentBeats}
          renderItem={(beat) => {
            const { id, title, status, coverArt, createdAt } = beat;
            const media = coverArt ? (
              <Thumbnail source={coverArt} alt={title} />
            ) : (
              <Thumbnail source={SoundIcon} alt={title} />
            );
            
            return (
              <ResourceItem
                id={id}
                url={`/app/beats/${id}`}
                media={media}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {title}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      {new Date(createdAt).toLocaleDateString()}
                    </Text>
                  </BlockStack>
                  <Badge tone={status === "Published" ? "success" : "info"}>
                    {status}
                  </Badge>
                </InlineStack>
              </ResourceItem>
            );
          }}
        />
      </BlockStack>
    </Card>
  </Layout.Section>
)}
```

---

### 5. Support Footer (Optional)

**Display:** Always (in page footer)

**Content:**
```
Link: "Need help? Contact Support" → /app/support
```

**Code:**
```tsx
<Page.Footer>
  <InlineStack align="center">
    <Text tone="subdued">
      Need help? <Link url="/app/support">Contact Support</Link>
    </Text>
  </InlineStack>
</Page.Footer>
```

---

## State Matrix

| Setup Status | Total Beats | Display |
|--------------|-------------|---------|
| Incomplete | Any | Setup banner + Quick stats (empty) |
| Complete | 0 | Quick stats (empty) + "Upload First Beat" card |
| Complete | > 0 | Quick stats + Recent beats list |

---

## Data Loading

### Loader Function

```tsx
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const productService = createProductCreatorService(session, admin);

  try {
    const setupStatus = await setupService.checkSetupStatus();

    // If setup incomplete, return minimal data
    if (!setupStatus.isComplete) {
      return json({
        setupStatus,
        stats: { totalBeats: 0, totalPlays: 0, totalSales: 0 },
        recentBeats: [],
      });
    }

    // Fetch actual data when setup complete
    const products = await productService.getProducts({ limit: 5 });
    const stats = await productService.getStats();

    return json({
      setupStatus,
      stats,
      recentBeats: products.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        coverArt: p.featuredImage?.url,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};
```

---

## Polaris Components

| Component | Usage | Docs |
|-----------|-------|------|
| Page | Main container | [Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |
| Layout | Section layout | [Layout](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/layout) |
| Banner | Setup incomplete alert | [Banner](https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-indicators/banner) |
| Card | Content containers | [Card](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/card) |
| Button | Primary CTAs | [Button](https://shopify.dev/docs/api/app-home/polaris-web-components/actions/button) |
| ResourceList | Recent beats list | [ResourceList](https://shopify.dev/docs/api/app-home/polaris-web-components/lists/resource-list) |
| Thumbnail | Beat cover art | [Thumbnail](https://shopify.dev/docs/api/app-home/polaris-web-components/images-and-icons/thumbnail) |
| Badge | Status indicators | [Badge](https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-indicators/badge) |

---

## Acceptance Criteria

- [ ] Setup banner displays when setup incomplete
- [ ] Setup banner links to `/app/setup`
- [ ] Quick stats show with empty state when no data
- [ ] "Upload First Beat" card shows when setup complete and no beats
- [ ] Recent beats list shows when beats exist
- [ ] Recent beats list limited to 5 items
- [ ] "View all" button links to `/app/beats`
- [ ] Cover art thumbnails display correctly
- [ ] Status badges show correct tone (success for Published, info for Draft)
- [ ] Support footer links to `/app/support`
- [ ] Page loads without error when setup incomplete
- [ ] Page loads actual data when setup complete

---

## References

- [Home Page Patterns](./skills/shopify-dev/patterns/home-page.md)
- [Shopify Homepage Template](https://shopify.dev/docs/api/app-home/patterns/templates/homepage)
- [Resource List Pattern](https://shopify.dev/docs/api/app-home/polaris-web-components/lists/resource-list)

---

## Implementation Notes

1. **Remove "blocked dashboard" logic** — Always render content, use banner for setup state
2. **Implement actual product fetching** — Replace TODO placeholders in `productService.getProducts()`
3. **Add stats calculation** — Implement `productService.getStats()` to query real data
4. **Handle loading states** — Use Polaris Spinner for data fetching
5. **Test empty states** — Verify UI when no beats exist
6. **Test error states** — Handle API failures gracefully
