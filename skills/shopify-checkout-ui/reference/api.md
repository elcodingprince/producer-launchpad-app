# API & Hooks Reference (API 2026-01)

## useApi()

Returns the full API object for your extension target. Properties are Preact Signals — read them with `.current` or destructure directly (auto-reactive in components).

```tsx
import { useApi } from '@shopify/ui-extensions-react/checkout';

function MyBlock() {
  const {
    order,           // Signal — current order data
    query,           // Function — Storefront API query
    appMetafields,   // Array — metafields declared in toml
    shop,            // Signal — shop info
    extension,       // Extension metadata
  } = useApi();
}
```

### Reading Signal Values

```tsx
const { order } = useApi();

// Signals: access .current in effects, or use directly in JSX (auto-reactive)
const orderId = order.current?.id;
```

---

## appMetafields

Array of metafields you declared in `shopify.extension.toml`. Only populated if `api_access = true`.

```tsx
const { appMetafields } = useApi();

// Find a specific metafield
const downloadUrl = appMetafields
  .find(m => m.namespace === 'producer_launchpad' && m.key === 'download_url')
  ?.value as string | undefined;

// Shape of each entry
// {
//   namespace: string
//   key: string
//   value: string
//   valueType: 'string' | 'integer' | 'json' | 'boolean'
// }
```

**Important:** `appMetafields` may be empty on first render (async load). Always handle the empty state:
```tsx
if (appMetafields.length === 0) return <Spinner accessibilityLabel="Loading" />;
if (!downloadUrl) return null;
```

---

## query() — Storefront API

Requires `api_access = true` in toml. Uses a pre-authenticated token automatically.

```tsx
const { query } = useApi();

// Basic query
const { data, errors } = await query(`
  query {
    shop {
      name
    }
  }
`);

// With variables
const { data } = await query(`
  query GetProduct($id: ID!) {
    product(id: $id) {
      title
      metafield(namespace: "custom", key: "my_field") {
        value
      }
    }
  }
`, { variables: { id: 'gid://shopify/Product/123' } });
```

**Use in useEffect:**
```tsx
import { useEffect, useState } from 'preact/hooks';

function MyBlock() {
  const { query } = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    query(`query { shop { name } }`)
      .then(({ data }) => setData(data))
      .catch(console.error);
  }, []);
}
```

---

## useExtensionApi()

Alias for `useApi()` — identical behavior. Prefer `useApi()`.

---

## Preact Signals vs Plain Values

| Property | Type | How to read |
|----------|------|-------------|
| `order` | Signal | `order.current?.id` |
| `shop` | Signal | `shop.current?.myshopifyDomain` |
| `appMetafields` | Plain array | Direct access |
| `query` | Plain function | Call directly |

---

## Available on `purchase.thank-you.block.render`

```tsx
const {
  order,             // Order details (id, lineItems, etc.)
  appMetafields,     // Declared metafields
  query,             // Storefront API
  shop,              // Shop info
  extension,         // { target, handle }
  i18n,              // Translations helper
  analytics,         // publish() for tracking events
} = useApi();
```
