# Dev Workflow & Deployment

## Local Development

```bash
# Start local dev server (runs app + extensions together)
npm run dev
# or
shopify app dev
```

- Opens a tunnel URL (ngrok or Cloudflare)
- Outputs a **preview URL** — open it to see your extension in a test checkout
- Hot reloads on file save
- Extension logs appear in terminal

**Preview a specific extension:**
The CLI prints a direct preview link like:
```
Preview your extension:
https://{store}.myshopify.com/admin/themes/current/editor?context=apps&template=page&activateAppId={id}/{handle}
```

---

## Deployment

### Step 1 — Deploy the extension
```bash
npm run deploy
# or
shopify app deploy
```

This pushes the extension code to Shopify. The extension is now available but **not yet visible to customers**.

### Step 2 — Enable in Shopify Admin (REQUIRED)

After deploying, merchants must manually add the block to their checkout:

1. Go to **Shopify Admin** → **Online Store** → **Checkout**
2. Click **Customize**
3. In the checkout editor, navigate to the **Thank you** page
4. Click **Add block** → find your app's extension
5. Drag it to the desired position
6. Click **Save**

**This step is easy to miss** — `shopify app deploy` alone does NOT make the extension visible.

---

## First-Time Setup

### Scaffold the extension (if not already done)
```bash
npm run shopify app generate extension
# Prompts:
# Type → Checkout UI
# Target → purchase.thank-you.block.render
# Name → download-portal-block
```

This creates:
```
extensions/
└── download-portal-block/
    ├── shopify.extension.toml
    └── src/
        └── ThankYouBlock.tsx
```

### Install extension dependencies
Extensions use their own `package.json` separate from the app:
```bash
cd extensions/download-portal-block
npm install @shopify/ui-extensions-react
```

Or they may share the root `node_modules` depending on your setup — check if a `package.json` exists in the extension folder.

---

## Testing Checklist

- [ ] `shopify app dev` runs without errors
- [ ] Preview URL loads the checkout
- [ ] Thank-you page shows the extension block
- [ ] Place a test order → webhook fires → metafield is saved
- [ ] Extension reads the metafield and shows the download button
- [ ] Download button links to the correct portal URL
- [ ] Non-beat orders: extension renders nothing (returns `null`)

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Extension not showing | Not added to checkout template | Add block in Shopify Admin → Checkout editor |
| `appMetafields` always empty | `api_access` not set | Add `api_access = true` to toml `[capabilities]` |
| Metafield not found | Namespace/key mismatch | Match exactly: `producer_launchpad` + `download_url` |
| Bundle too large | Dependencies too heavy | Check bundle size — max 64 KB |
| External fetch fails | `network_access` not approved | Enable in Partner Dashboard or use `query()` instead |
