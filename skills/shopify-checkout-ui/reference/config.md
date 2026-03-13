# shopify.extension.toml Reference

## Full Example

```toml
name = "Download Portal Block"
handle = "download-portal-block"
type = "checkout_ui_extension"

[[extension_points]]
target = "purchase.thank-you.block.render"
module = "./src/ThankYouBlock.tsx"

[capabilities]
api_access = true        # Required for appMetafields + query()
network_access = false   # External HTTP calls — requires Partner Dashboard approval

[[metafields]]
namespace = "producer_launchpad"
key = "download_url"

# Optional: merchant-configurable settings (up to 20)
[[settings.fields]]
key = "heading_text"
type = "single_line_text_field"
name = "Heading text"
```

---

## [capabilities]

| Key | Default | Description |
|-----|---------|-------------|
| `api_access` | `false` | Enables `appMetafields` and `query()` (Storefront API) |
| `network_access` | `false` | Enables `fetch()` to external URLs. Requires approval in Partner Dashboard → App → Distribution |
| `block_progress` | `false` | Allows extension to prevent checkout completion (Plus only) |

**For this project:** only `api_access = true` is needed.

---

## [[metafields]]

Declares which metafields to expose via `appMetafields`. Can declare up to 10.

```toml
[[metafields]]
namespace = "producer_launchpad"
key = "download_url"

[[metafields]]
namespace = "custom"
key = "another_field"
```

Supported owner resources: `order`, `product`, `variant`, `customer`, `cart`, `shop`

---

## [[extension_points]]

```toml
[[extension_points]]
target = "purchase.thank-you.block.render"
module = "./src/ThankYouBlock.tsx"
```

Multiple targets in one extension:
```toml
[[extension_points]]
target = "purchase.thank-you.block.render"
module = "./src/ThankYouBlock.tsx"

[[extension_points]]
target = "purchase.checkout.block.render"
module = "./src/CheckoutBlock.tsx"
```

---

## [[settings.fields]]

Merchant-configurable values accessible via `useSettings()` hook. Up to 20 fields.

```toml
[[settings.fields]]
key = "button_text"
type = "single_line_text_field"
name = "Button label"

[[settings.fields]]
key = "show_banner"
type = "boolean"
name = "Show success banner"
```

Types: `single_line_text_field`, `multi_line_text_field`, `number_integer`, `number_decimal`, `boolean`, `url`

Read in component:
```tsx
import { useSettings } from '@shopify/ui-extensions-react/checkout';
const { button_text, show_banner } = useSettings();
```
