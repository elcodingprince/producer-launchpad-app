# Shopify App Design — Component Patterns

Detailed, copy-paste-ready patterns for common Shopify embedded app UI scenarios.

---

## File Type Chip (icon + label)

Matches the setup wizard's icon badge pattern. Never use hardcoded hex colors.

```tsx
// Valid background tokens per file type:
// MP3     → bg-surface-success  | Icon tone: success
// WAV     → bg-surface-secondary | Icon tone: base
// Stems   → bg-surface-warning  | Icon tone: caution
// Preview → bg-surface-magic    | Icon tone: magic
// Cover   → bg-surface-magic    | Icon tone: magic

<InlineStack gap="150" blockAlign="center">
  <Box background="bg-surface-success" padding="150" borderRadius="100">
    <Icon source={SoundIcon} tone="success" />
  </Box>
  <Text as="span" variant="bodySm" fontWeight="semibold">MP3</Text>
</InlineStack>
```

---

## File Row (uploaded file item)

Compact horizontal row — matches Shopify resource list density.
Never use large square tiles for file items.

```tsx
<Box borderWidth="025" borderColor="border" borderRadius="200" padding="300">
  <InlineStack gap="300" blockAlign="center">
    {/* File type chip */}
    <InlineStack gap="150" blockAlign="center">
      <Box background="bg-surface-success" padding="150" borderRadius="100">
        <Icon source={SoundIcon} tone="success" />
      </Box>
      <Text as="span" variant="bodySm" fontWeight="semibold">MP3</Text>
    </InlineStack>

    {/* Name + size */}
    <BlockStack gap="0">
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
        <Text as="span" variant="bodySm" fontWeight="medium">{file.name}</Text>
      </div>
      <Text as="span" variant="bodyXs" tone="subdued">{file.size}</Text>
    </BlockStack>

    {/* Remove — always plain, never primary */}
    <Button icon={XIcon} variant="plain" onClick={onRemove} accessibilityLabel="Remove file" />
  </InlineStack>
</Box>
```

---

## File Upload — DropZone States

### Empty state (normal DropZone)
```tsx
<DropZone onDrop={handleDrop} accept=".mp3,.wav,.zip" type="file" allowMultiple>
  <DropZone.FileUpload actionHint=".mp3, .wav, .zip" />
</DropZone>
```

### Files present — "Add more" button (hidden input pattern)
Replace the big dropzone with a Button that triggers a hidden `<input>`. Do NOT use an inline mini-DropZone as a dashed box in a header — it looks inconsistent.

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  await processFiles(files);
  if (fileInputRef.current) fileInputRef.current.value = ''; // reset so same file can re-trigger
}, [processFiles]);

// In render:
<>
  <Button icon={PlusIcon} onClick={() => fileInputRef.current?.click()}>
    Add files
  </Button>
  <input
    ref={fileInputRef}
    type="file"
    multiple
    accept=".mp3,.wav,.zip"
    style={{ display: 'none' }}
    onChange={handleFileInputChange}
  />
</>
```

---

## Cover Art / Image Slot

Fixed square. Clean bordered container. No gradients, no custom backgrounds on filled state.

```tsx
// Empty
<div style={{ height: '160px' }}>
  <DropZone onDrop={handleCoverDrop} accept="image/jpeg,image/png,image/webp" type="image" allowMultiple={false}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '16px' }}>
      <Icon source={ImageIcon} tone="base" />
      <Text as="span" variant="bodyXs" tone="subdued" alignment="center">Add image</Text>
    </div>
  </DropZone>
</div>

// Filled — no gradient, no colored overlay
<div style={{ position: 'relative', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--p-color-border)' }}>
  <img src={previewUrl} alt="Cover art" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
    {/* variant="plain" — not primary, not critical */}
    <Button icon={XIcon} variant="plain" onClick={onRemove} accessibilityLabel="Remove cover art" />
  </div>
</div>
```

---

## Media Card — 2-Column Layout

Cover art (fixed left) + audio/files (right). Saves ~2 viewport heights vs stacked sections.

```tsx
<Card>
  <BlockStack gap="500">
    <Text variant="headingMd" as="h2">Media</Text>

    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '24px', alignItems: 'start' }}>

      {/* Left: Cover Art */}
      <BlockStack gap="200">
        <Text variant="bodySm" as="p" tone="subdued">Cover art</Text>
        {/* image slot here */}
      </BlockStack>

      {/* Right: Audio + License Files */}
      <BlockStack gap="500">
        <BlockStack gap="300">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingSm" as="h3">Preview audio</Text>
            <Text as="span" variant="bodySm" tone="subdued">(required)</Text>
          </InlineStack>
          {/* preview dropzone or file row */}
        </BlockStack>

        <Divider />

        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingSm" as="h3">License files</Text>
            {/* "Add files" button when files exist */}
          </InlineStack>
          {/* dropzone or file rows */}
        </BlockStack>
      </BlockStack>
    </div>
  </BlockStack>
</Card>
```

---

## Left-Rail Navigation Panel

For variant/license editors. Emulates Shopify's variant detail page pattern without leaving the page.

```tsx
<Card padding="0">
  <Box padding="400" paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
    <Text variant="headingMd" as="h2">License packages</Text>
  </Box>

  <div style={{ display: 'flex', minHeight: '260px' }}>

    {/* Left rail */}
    <Box borderInlineEndWidth="025" borderColor="border" minWidth="180px">
      {licenses.map((tier, index) => {
        const isActive  = activeTier === tier.id;
        const hasFiles  = (licenseFiles[tier.id]?.length || 0) > 0;
        const isNotLast = index < licenses.length - 1;
        return (
          <div
            key={tier.id}
            onClick={() => setActiveTier(tier.id)}
            style={{
              cursor: 'pointer',
              borderBottom: isNotLast ? '1px solid var(--p-color-border)' : 'none',
              borderLeft: isActive
                ? '3px solid var(--p-color-border-interactive)'
                : '3px solid transparent',
            }}
          >
            <Box padding="400" background={isActive ? 'bg-surface-selected' : undefined}>
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodyMd" as="span" fontWeight={isActive ? 'semibold' : 'regular'}>
                  {tier.name}
                </Text>
                <Icon
                  source={hasFiles ? CheckCircleIcon : AlertDiamondIcon}
                  tone={hasFiles ? 'success' : 'caution'}
                />
              </InlineStack>
              <Text variant="bodySm" as="p" tone="subdued">{tier.price}</Text>
            </Box>
          </div>
        );
      })}
    </Box>

    {/* Right panel */}
    {activeLicense && (
      <Box padding="500" width="100%">
        <BlockStack gap="400">
          <Text variant="headingSm" as="h3">{activeLicense.name} package</Text>
          {/* file assignment content */}
        </BlockStack>
      </Box>
    )}
  </div>
</Card>
```

---

## Variant/License Table

Matches Shopify's native Variants table. Raw HTML table required — Box cannot use `as="th"/"td"`.

```tsx
<Card padding="0">
  <Box padding="400" paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
    <Text variant="headingMd" as="h2">Beat licenses</Text>
  </Box>
  <Box padding="400">
    <div style={{ border: '1px solid var(--p-color-border)', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--p-color-bg-surface-secondary)', borderBottom: '1px solid var(--p-color-border)' }}>
            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Variant</th>
            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Price</th>
            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Available</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((tier, index) => (
            <tr key={tier.id} style={{ borderBottom: index < licenses.length - 1 ? '1px solid var(--p-color-border)' : 'none' }}>
              <td style={{ padding: '12px 16px' }}>
                <InlineStack gap="300" blockAlign="center">
                  <Box background="bg-surface" borderWidth="025" borderColor="border" borderRadius="100" padding="150">
                    <Icon source={tier.icon} tone={tier.tint} />
                  </Box>
                  <Text variant="bodyMd" as="span" fontWeight="medium">{tier.name}</Text>
                </InlineStack>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <Text variant="bodyMd" as="span">{tier.price}</Text>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <Text variant="bodyMd" as="span" tone="subdued">—</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Box>
</Card>
```

---

## Card Header Pattern (Shopify-native)

Matches the visual weight of Shopify Admin section headers.

```tsx
<Card padding="0">
  {/* Header */}
  <Box padding="400" paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
    <Text variant="headingMd" as="h2">Section title</Text>
  </Box>

  {/* Body */}
  <Box padding="400">
    {/* content */}
  </Box>
</Card>
```

---

## Setup Wizard Icon Badge (from app.setup.tsx)

Used in the setup wizard for feature highlight cards. Reuse this pattern for any icon-in-a-box.

```tsx
<Box background="bg-surface-success" padding="100" borderRadius="100">
  <Icon source={CollectionIcon} tone="success" />
</Box>
```

---

## Completion Checklist Before Shipping UI

- [ ] Zero hardcoded hex colors
- [ ] No `<hr>` — replaced with `<Divider />`
- [ ] No `variant="primary"` on remove/delete buttons
- [ ] No `Badge tone="attention"` for required field indicators
- [ ] No `Box as="th"/"td"/"button"`
- [ ] No `borderColor="border-interactive"` in Box — use CSS var directly
- [ ] All headings in sentence case
- [ ] Max 1 primary action per card
- [ ] File items are compact rows, not square tiles
- [ ] Image slots have no gradient overlays
- [ ] `(required)` shown as inline subdued text, not badge
- [ ] Colors paired with text/icon (never color-only meaning)
