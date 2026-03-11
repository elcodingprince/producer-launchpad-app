# Page Design Patterns

**Sources:**
- [Layout](https://shopify.dev/docs/apps/design/layout)
- [Visual Design](https://shopify.dev/docs/apps/design/visual-design)
- [Content](https://shopify.dev/docs/apps/design/content)

---

## Purpose

Layout design arranges visual elements (text, images, shapes) on a page to create clear hierarchy and support task completion.

---

## Responsive Design

### ✅ DO
- ✅ **Design for multiple screen sizes** — App should adapt to desktop, tablet, mobile
- ✅ **Use Polaris Page's built-in responsiveness** — `aside` slot adapts automatically
- ✅ **Use Polaris Grid for custom responsive behavior** — When you need more control
- ✅ **Test on different devices** — Ensure consistent experience across platforms

### ❌ DON'T
- ❌ **Don't assume desktop-only usage** — Many merchants use mobile
- ❌ **Don't break layouts on small screens** — Content should reflow gracefully

---

## Layout Options

### Single-Column Layout

**Use when:**
- Homepage with one obvious task
- Merchants need to scan top-to-bottom
- Focusing attention on single workflow

**✅ DO:**
- ✅ Use default-width page for most content
- ✅ Use full-width page for resource index (product lists with many columns)

```tsx
<Page title="Upload Beat">
  <BlockStack gap="500">
    <Card>
      {/* Beat details form */}
    </Card>
    <Card>
      {/* File upload */}
    </Card>
  </BlockStack>
</Page>
```

### Two-Column Layout

**Use when:**
- Visual editors (preview + controls)
- Content-dense pages
- Related content needs to be visible simultaneously

**✅ DO:**
- ✅ Allow merchants to preview outcomes in real-time
- ✅ Keep related content together

```tsx
<Page title="Edit Beat">
  <Grid>
    <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6}}>
      {/* Editor controls */}
    </Grid.Cell>
    <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6}}>
      {/* Preview */}
    </Grid.Cell>
  </Grid>
</Page>
```

### Settings Layout

**Use when:**
- Configuration pages
- Multiple related settings groups

**✅ DO:**
- ✅ Use [settings pattern](https://shopify.dev/docs/api/app-home/patterns/templates/settings)
- ✅ Provide clear context about configuration options
- ✅ Use narrow left column for titles/descriptions, wider right for form elements

```tsx
<Page title="Settings">
  <SettingsPage>
    {/* Thin left column: titles & descriptions */}
    {/* Wide right column: form elements */}
  </SettingsPage>
</Page>
```

---

## Spacing

### ✅ DO
- ✅ **Use 4px spacing grid** — Matches Shopify admin's spacing system
- ✅ **Use Polaris Stack component** — Simplifies consistent spacing
- ✅ **Maintain visual rhythm** — Keep spacing consistent throughout app

### ❌ DON'T
- ❌ **Don't use arbitrary spacing values** — Stick to 4px increments (4, 8, 12, 16, etc.)

```tsx
// ✅ DO: Use Polaris Stack for consistent spacing
<BlockStack gap="400">
  <Card>Content 1</Card>
  <Card>Content 2</Card>
</BlockStack>

// ❌ DON'T: Arbitrary spacing
<div style={{ marginBottom: '13px' }}>...</div>
```

---

## Information Density

### ✅ DO
- ✅ **Use looser spacing for low-density layouts** — When readability is priority
- ✅ **Use tighter spacing for high-density layouts** — When showing lots of data (tables, lists)
- ✅ **Provide right density for the task** — Match density to user need

### ❌ DON'T
- ❌ **Don't change density within single page** — Makes app feel disjointed
- ❌ **Don't make everything high-density** — Reduces scannability

---

## Containers & Sections

### ✅ DO
- ✅ **Put majority of content in containers** — Use cards or sections for structure
- ✅ **Use Polaris Section component** — Segments content while respecting guidelines
- ✅ **Limit to one primary CTA per interactive card** — Avoid multiple primary buttons
- ✅ **Use secondary styling for table actions** — Text buttons, minor icons, or dropdowns

### ❌ DON'T
- ❌ **Don't place paragraphs directly on background** — Reduces legibility, hard to scan
- ❌ **Don't use multiple primary buttons in one card** — Confuses priority
- ❌ **Don't use primary buttons in tables** — Too visually heavy

```tsx
// ✅ DO: Content in container with clear CTA hierarchy
<Card>
  <BlockStack gap="400">
    <Text>Upload your beat to start selling licenses.</Text>
    <Button variant="primary">Upload Beat</Button>
    <Link url="/templates">View templates</Link>
  </BlockStack>
</Card>

// ❌ DON'T: Text directly on background
<Page>
  <Text>This text is hard to read...</Text>
</Page>

// ❌ DON'T: Multiple primary CTAs
<Card>
  <Button variant="primary">Upload</Button>
  <Button variant="primary">Save</Button> {/* ❌ Too many primary */}
</Card>
```

---

## Tables

### ✅ DO
- ✅ **Use Polaris Table** — For simple summaries
- ✅ **Use Index table pattern** — For lots of data
- ✅ **Use Resource index layout** — When summarizing resource objects
- ✅ **Use secondary actions in tables** — Text buttons, icons, dropdowns

### ❌ DON'T
- ❌ **Don't use primary buttons in tables** — Visually overwhelming

```tsx
// ✅ DO: Secondary actions in table
<IndexTable>
  <IndexTable.Row>
    <IndexTable.Cell>{/* Data */}</IndexTable.Cell>
    <IndexTable.Cell>
      <Button variant="plain">Edit</Button> {/* ✅ Secondary style */}
    </IndexTable.Cell>
  </IndexTable.Row>
</IndexTable>

// ❌ DON'T: Primary buttons in table
<Table>
  <Table.Row>
    <Table.Cell>
      <Button variant="primary">Edit</Button> {/* ❌ Too heavy */}
    </Table.Cell>
  </Table.Row>
</Table>
```

---

## Polaris Components Reference

| Component | Use Case | Docs |
|-----------|----------|------|
| **Page** | Main page container with responsive slots | [Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |
| **Grid** | Custom responsive layouts | [Grid](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/grid) |
| **BlockStack** | Vertical spacing | [BlockStack](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/blockstack) |
| **InlineStack** | Horizontal spacing | [InlineStack](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/inlinestack) |
| **Card** | Container for grouped content | [Card](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/card) |
| **Section** | Content segmentation | [Section](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/section) |
| **Table** | Simple data tables | [Table](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table) |
| **IndexTable** | Complex data tables with actions | [Index Table Pattern](https://shopify.dev/docs/api/app-home/patterns/compositions/index-table) |

---

## Layout Patterns Reference

- [Resource Index Layout](https://shopify.dev/docs/api/app-home/patterns/templates/index)
- [Settings Pattern](https://shopify.dev/docs/api/app-home/patterns/templates/settings)
- [Homepage Pattern](https://shopify.dev/docs/api/app-home/patterns/templates/homepage)

---

## Key Takeaways

1. **4px spacing grid** — Use consistent increments
2. **Content in containers** — Don't place text directly on background
3. **One primary CTA** — Per interactive card
4. **Responsive by default** — Use Polaris components
5. **Match density to task** — Low density for readability, high for data
6. **Secondary actions in tables** — Never primary buttons
