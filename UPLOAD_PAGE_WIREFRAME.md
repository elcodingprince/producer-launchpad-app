# Upload New Beat Page Redesign Wireframes (V1)

## Current Problems
1. The page is horribly split. The beat metadata form completely separates the the title/details from the actual file upload dropzones.
2. It's too long. The `LicenseFileAssignment` component is a massive vertical stack that stacks Dropzone 1 (Preview) on top of Dropzone 2 (License Files) on top of 3 separate cards for Tier Assignment.
3. The "Create Beat Product" button is all the way at the very bottom, creating a disjointed submission experience.
4. It does not look or feel like native Shopify UI (which usually uses a 2-column layout for product creation: main column on left, metadata column on right).

## Proposed Layout Structure (Shopify Native V12)

We will refactor `/app/routes/app.beats.new.tsx` to use the standard Shopify Admin "Product Create" layout pattern.

```javascript
<Layout>
  <Layout.Section>
    {/* Main Column (Files & Core Details) */}
  </Layout.Section>
  <Layout.Section variant="oneThird">
    {/* Right Sidebar (Metadata & Organization) */}
  </Layout.Section>
</Layout>
```

### Main Column (Left - 2/3 width)

**Card 1: Beat Details**
*   Title Input
*   BPM Input
*   Key Dropdown

**Card 2: Upload Files**
*   We will consolidate the `LicenseFileAssignment` component experience to fit inside this main column.
*   **Step 1:** Small Preview Dropzone (clearly marked for Storefront Audio Player).
*   **Step 2:** Main License Files Dropzone (MP3, WAV, Stems).
*   **Step 3:** The License Assignment UI. Instead of massive vertical cards, we will stack them cleanly or use an InlineGrid to save vertical space.

### Right Sidebar (Right - 1/3 width)

**Card 3: Organization (Categorization)**
*   Producer ChoiceList (or Combobox)
*   Producer Alias Textfield
*   Genre ChoiceList (or Tags/Badges style selector)

**Card 4: Publishing**
*   Summary of readiness (e.g. "All tiers assigned", "Preview ready").
*   Big Primary "Create Beat" Button (Moved up into the sidebar so it's always visible).

## Action Plan

1.  **Refactor `/app/routes/app.beats.new.tsx`**: Change the layout to `Layout.Section` and `Layout.Section variant="oneThird"`. Move the Genre and Producer states into the right sidebar column. Move the Submit button to a sticky/top card in the right sidebar.
2.  **Refactor `/app/components/LicenseFileAssignment.tsx`**: Slim down the UI of the assignment block so it fits comfortably within the left column alongside the title/bpm details, rather than sprawling down the entire page.
