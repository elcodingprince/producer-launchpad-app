# Pattern: License Delivery Download Button (producer-launchpad)

**Target:** `purchase.thank-you.block.render`
**Goal:** Show a "Download Your Beats" button after purchase, linking to the secure download portal token saved in the order metafield `producer_launchpad.download_url`.

---

## Architecture

```
Order placed
  → webhooks.orders-create.tsx generates secureToken
  → Saves token URL to order metafield: producer_launchpad.download_url
  → Thank-you page loads
  → This extension reads that metafield
  → Renders download button → /downloads/{token}
```

---

## File: `extensions/download-portal-block/src/ThankYouBlock.tsx`

```tsx
import {
  reactExtension,
  useApi,
  BlockStack,
  Button,
  Text,
  Heading,
  Banner,
  Spinner,
  Box,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <DownloadBlock />
);

function DownloadBlock() {
  const { appMetafields } = useApi();

  const downloadUrl = appMetafields
    .find(m => m.namespace === 'producer_launchpad' && m.key === 'download_url')
    ?.value as string | undefined;

  // Metafields may not be available immediately — show loading state
  if (appMetafields.length === 0) {
    return (
      <Box padding="base">
        <Spinner accessibilityLabel="Loading your downloads" />
      </Box>
    );
  }

  // Order doesn't have beat files (not a beat order)
  if (!downloadUrl) {
    return null;
  }

  return (
    <Banner tone="success" heading="Your beats are ready!">
      <BlockStack gap="base">
        <Text>
          Download your high-quality audio files and customized license agreement instantly.
        </Text>
        <Button
          href={downloadUrl}
          target="_blank"
          variant="primary"
        >
          Access Download Portal
        </Button>
      </BlockStack>
    </Banner>
  );
}
```

---

## File: `extensions/download-portal-block/shopify.extension.toml`

```toml
name = "Download Portal Block"
handle = "download-portal-block"
type = "checkout_ui_extension"

[[extension_points]]
target = "purchase.thank-you.block.render"
module = "./src/ThankYouBlock.tsx"

[capabilities]
api_access = true

[[metafields]]
namespace = "producer_launchpad"
key = "download_url"
```

---

## Notes

- `appMetafields` is an array — always `.find()` by namespace + key
- Return `null` if `downloadUrl` is missing — hides the block cleanly for non-beat orders
- `Banner tone="success"` auto-announces to screen readers
- The `href` on `Button` opens the download portal in a new tab
- The order metafield (`producer_launchpad.download_url`) is set in `webhooks.orders-create.tsx` using the `portalUrl` constructed from `secureToken`

---

## Order Metafield Setup (webhook side)

The webhook at `app/routes/webhooks.orders-create.tsx` must save the URL as an order metafield:

```typescript
// After creating delivery token...
const portalUrl = `https://${process.env.APP_URL}/downloads/${delivery.secureToken}`;

// Save to order metafield via Admin GraphQL
await admin.graphql(`
  mutation orderMetafieldSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`, {
  variables: {
    metafields: [{
      ownerId: \`gid://shopify/Order/\${orderId}\`,
      namespace: "producer_launchpad",
      key: "download_url",
      type: "url",
      value: portalUrl,
    }]
  }
});
```
