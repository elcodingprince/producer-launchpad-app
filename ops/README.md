# Merchant Registry

The merchant registry is the private source of truth for the multi-merchant app
fleet. It tells release scripts which merchant Fly apps exist and which Shopify
shop/app identity each one belongs to.

Keep the registry operational, not secret-bearing:

- include Fly app names, shop domains, app URLs, custom domains, Shopify client
  app names, Shopify client IDs, internal merchant IDs, and status
- do not include Shopify API secrets, session secrets, database URLs, R2 keys, or
  other credentials
- keep real merchant registry files private and gitignored

## Files

- `merchants.example.json` is committed and documents the expected shape.
- `merchants.local.json` is gitignored and is the default local/private registry.
- `../scripts/validate-merchant-registry.mjs` validates either file before
  deploy automation reads it.

## Usage

Validate the private local registry:

```bash
npm run merchant-registry:validate
```

Validate a specific registry file:

```bash
npm run merchant-registry:validate -- ops/merchants.example.json
```

Use `merchantId` as the stable infrastructure key, like `m001`, and use `slug`
as the stable human-readable merchant key. Fly app names should usually follow
the internal ID, like `pl-m001`, while Shopify app names should stay readable,
like `Producer Launchpad - New Radio Sound`.

Use `status` to keep planned or paused merchants in the registry without
deploying to them.
