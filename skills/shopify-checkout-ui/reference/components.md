# Checkout UI Components Reference (API 2026-01)

## Layout

### Stack
Organizes children vertically (`block`) or horizontally (`inline`).
```tsx
<Stack direction="block" gap="base">...</Stack>
<Stack direction="inline" gap="tight" justifyContent="space-between">...</Stack>
```
Props: `direction`, `gap`, `justifyContent`, `alignItems`, `blockSize`, `inlineSize`

### Box
Generic container with styling options.
```tsx
<Box padding="base" background="subdued" borderRadius="base">...</Box>
```
Props: `padding`, `background` (`base`|`subdued`|`transparent`), `border`, `borderRadius`, `borderWidth`, `blockSize`, `inlineSize`, `accessibilityRole`

### Grid
Matrix layout for multi-column designs.
```tsx
<Grid gridTemplateColumns="1fr 1fr" gap="base">
  <GridItem>...</GridItem>
</Grid>
```

### Section
Groups related content with auto-adjusted heading levels.
```tsx
<Section heading="Order Summary">...</Section>
```

### Divider
```tsx
<Divider direction="block" />  {/* vertical */}
<Divider />                     {/* horizontal (default) */}
```

---

## Typography

### Text
```tsx
<Text tone="subdued">secondary text</Text>
<Text type="strong">bold text</Text>
<Text type="small">small text</Text>
```
Props: `color` (`base`|`subdued`), `tone` (`auto`|`success`|`warning`|`critical`|`info`|`neutral`), `type` (`generic`|`strong`|`emphasis`|`small`|`mark`)

### Heading
```tsx
<Heading>Section Title</Heading>
```
Auto-determines h-level based on nesting within `<Section>`.

### Paragraph
```tsx
<Paragraph tone="subdued">Block text content</Paragraph>
```
Props: same as `Text` plus `type: 'paragraph'|'small'`

---

## Actions

### Button
```tsx
{/* Link button */}
<Button href="https://example.com" target="_blank">Download</Button>

{/* Action button */}
<Button variant="primary" onClick={() => {}}>Submit</Button>
<Button variant="secondary" loading={isLoading}>Loading...</Button>
<Button disabled>Disabled</Button>
```
Props:
- `variant`: `primary` | `secondary` | `auto`
- `tone`: `neutral` | `critical` | `auto`
- `href`: URL (turns button into a link)
- `target`: `auto` | `_blank`
- `disabled`: boolean
- `loading`: boolean
- `inlineSize`: `auto` | `fill` | `fit-content`
- `accessibilityLabel`: screen reader text

### Link
```tsx
<Link href="https://example.com" target="_blank">Click here</Link>
```

---

## Feedback & Status

### Banner
Auto-announces to screen readers when rendered.
```tsx
<Banner tone="success" heading="Ready!">
  <Text>Your files are ready to download.</Text>
</Banner>

<Banner tone="critical" heading="Error" dismissible>
  <Text>Something went wrong.</Text>
</Banner>
```
Props: `tone` (`auto`|`info`|`success`|`warning`|`critical`), `heading`, `dismissible`, `collapsible`

### Spinner
```tsx
<Spinner accessibilityLabel="Loading your downloads" size="base" />
```
Sizes: `small` | `base` | `large`

### Badge
```tsx
<Badge tone="success" icon="check">Complete</Badge>
```

### Icon
```tsx
<Icon type="delivery" size="base" tone="success" />
```
Common types: `cart`, `check`, `alert-circle`, `star`, `delivery`, `lock`, `calendar`, `email`, `settings`
Sizes: `small` | `base` | `large`

---

## Media

### Image
```tsx
<Image src={url} alt="Cover art" inlineSize="fill" aspectRatio={1} loading="lazy" />
```
Props: `src`, `alt`, `srcSet`, `inlineSize` (`fill`|`auto`), `aspectRatio`, `objectFit` (`contain`|`cover`), `loading` (`eager`|`lazy`)

---

## NOT Supported in API 2026-01

- `TextField` — use standard HTML via workarounds
- `BlockStack` — use `Stack direction="block"` instead
- `InlineStack` — use `Stack direction="inline"` instead
- `DateField`, `DatePicker`, `MoneyField`, `PhoneField`, `EmailField`
