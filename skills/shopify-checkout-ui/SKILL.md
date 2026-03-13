---
name: shopify-checkout-ui
description: Build Shopify Checkout UI Extensions using @shopify/checkout-ui-extensions-react. Use when building thank-you page blocks, checkout extensions, reading order metafields, querying Storefront API from extensions, or asking "how do I show a download button on the thank you page", "how do I read order metafields in an extension", "what components can I use in checkout", "how do I scaffold a checkout extension".
---

# Shopify Checkout UI Extensions

**API Version:** 2026-01
**Framework:** Preact + Signals
**Bundle limit:** 64 KB max

---

## Key Rules (Read First)

- **No HTML** — only Shopify-provided components (`Button`, `Text`, `Stack`, etc.)
- **No CSS** — merchant branding is inherited automatically
- **No DOM access** — runs in a Web Worker sandbox
- **Signals** — reactive values use `.value` to read: `shopify.order.value`
- **Plus only** — Information/Shipping/Payment steps require Shopify Plus. Thank-you page is available to all.

---

## Entry Point Pattern

```tsx
import { reactExtension, useApi } from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <MyBlock />
);

function MyBlock() {
  const { order, query, appMetafields } = useApi();
  // ...
}
```

---

## Extension Targets (Common)

| Target | Description |
|--------|-------------|
| `purchase.thank-you.block.render` | Block on thank-you page ✅ (our target) |
| `purchase.thank-you.header.render-after` | Below thank-you header |
| `purchase.thank-you.cart-line-item.render-after` | After each line item |
| `purchase.checkout.block.render` | Generic block in checkout |

---

## Reading Order Metafields

**Step 1 — Declare in `shopify.extension.toml`:**
```toml
[[metafields]]
namespace = "producer_launchpad"
key = "download_url"
```

**Step 2 — Read in component:**
```tsx
const { appMetafields } = useApi();
const downloadUrl = appMetafields
  .find(m => m.key === 'download_url' && m.namespace === 'producer_launchpad')
  ?.value;
```

**Alternative — query via Storefront API:**
Requires `api_access = true` in toml. See [reference/api.md](reference/api.md).

---

## Core Components Quick Reference

**Layout:**
- `<Stack direction="block" gap="base">` — vertical stack
- `<Stack direction="inline" gap="base">` — horizontal stack
- `<Box padding="base" background="subdued">` — container with styling

**Content:**
- `<Text tone="subdued">` / `<Heading>` / `<Paragraph>`
- `<Banner tone="success" heading="Ready!">` — status messages
- `<Spinner accessibilityLabel="Loading">` — loading state
- `<Icon type="cart" size="base">` — 66+ icons

**Actions:**
- `<Button href={url} target="_blank">Download</Button>` — link button
- `<Button variant="primary">` / `variant="secondary"` / `variant="auto"`

For full component props → [reference/components.md](reference/components.md)

---

## `shopify.extension.toml` Structure

```toml
name = "Download Portal Block"
handle = "download-portal-block"
type = "checkout_ui_extension"

[[extension_points]]
target = "purchase.thank-you.block.render"
module = "./src/ThankYouBlock.tsx"

[capabilities]
api_access = true          # Enables query() + appMetafields
network_access = false     # External HTTP — needs Partner Dashboard approval
```

Full config reference → [reference/config.md](reference/config.md)

---

## Scaffold Command

```bash
npm run shopify app generate extension
# Select: Checkout UI Extension
# Select target: purchase.thank-you.block.render
```

---

## For This Project (License Delivery Download Button)

See the complete implementation pattern:
→ [patterns/download-portal-block.md](patterns/download-portal-block.md)

---

## Supporting Reference

- **Components** — [reference/components.md](reference/components.md)
- **API & Hooks** — [reference/api.md](reference/api.md)
- **Config (toml)** — [reference/config.md](reference/config.md)
- **Dev & Deploy** — [reference/dev-and-deploy.md](reference/dev-and-deploy.md)
- **Download Block Pattern** — [patterns/download-portal-block.md](patterns/download-portal-block.md)
