# Producer Launchpad - Custom Distribution DFY Launch Plan

## Current Progress

This is the canonical launch plan for Producer Launchpad as of May 22, 2026.

It consolidates the active launch scope from:

- [BILLING_AND_FULFILLMENT_PLAN.md](/Users/payan/producer-launchpad-app/BILLING_AND_FULFILLMENT_PLAN.md)
- [LAUNCH_WEEK_CHECKLIST.md](/Users/payan/producer-launchpad-app/LAUNCH_WEEK_CHECKLIST.md)
- [PRODUCT_EXECUTION_PLAN.md](/Users/payan/producer-launchpad-app/PRODUCT_EXECUTION_PLAN.md)
- [IMPLEMENTATION_CONTINUATION_PLAN.md](/Users/payan/producer-launchpad-app/IMPLEMENTATION_CONTINUATION_PLAN.md)
- [LICENSE_DELIVERY_AUTOMATION_PLAN.md](/Users/payan/producer-launchpad-app/LICENSE_DELIVERY_AUTOMATION_PLAN.md)
- [RESEND_EMAIL_IMPLEMENTATION_PLAN.md](/Users/payan/producer-launchpad-app/RESEND_EMAIL_IMPLEMENTATION_PLAN.md)
- [APP_IA_AND_HOME_REBUILD_PLAN.md](/Users/payan/producer-launchpad-app/APP_IA_AND_HOME_REBUILD_PLAN.md)
- [docs/PRE_SUBMISSION_CHECKLIST.md](/Users/payan/producer-launchpad-app/docs/PRE_SUBMISSION_CHECKLIST.md)
- [big-bang-theme/_docs/launch-plan-v1.md](/Users/payan/shopify/big-bang-theme/_docs/launch-plan-v1.md)

Theme/storefront dependencies were checked against:

- `/Users/payan/shopify/big-bang-theme`
- `sections/main-product.liquid`
- `assets/variant-logic.js`
- `assets/license-consent.js`
- `templates/cart.liquid`
- `sections/cart-popup.liquid`
- `snippets/license-metaobject-data.liquid`

## Launch Model

Producer Launchpad is a custom-distribution app delivered as a done-for-you service. The codebase stays shared, but each merchant gets their own Partners Dashboard app entry, unique Shopify API credentials, and dedicated Fly.io app deployment. A shared PostgreSQL database is acceptable because every app data model scopes records by `shop` domain.

The launch path is:

- custom theme plus embedded Shopify app
- done-for-you merchant onboarding
- one Fly.io app deployment per merchant
- one shared PostgreSQL database, all merchants scoped by `shop` field
- one Partners Dashboard custom app entry per merchant
- Stripe for app subscription and optional DFY setup fee
- no App Store listing, no App Store review
- no self-serve installs
- no support for arbitrary third-party themes

Shopify custom distribution is limited to one store per app entry. The compliant multi-merchant path is therefore one separate Partners Dashboard app entry per merchant, one matching Fly.io app per merchant, and one shared repo deployed repeatedly. Shopify Billing API is not available for custom apps; Stripe is the billing rail for both the recurring app subscription and any separately contracted DFY setup fee.

Important platform constraint: a normal dev store is for app/theme testing and cannot be transferred to a client. A client transfer store is the correct store type for building a merchant store to hand off, but custom and draft apps cannot be installed on it while it is still in the Partner organization. The app install therefore happens after transfer, or on an already merchant-owned store through collaborator access.

### Billing Position

- Shopify Billing API is not available for custom distribution apps. Stripe is the billing rail for everything.
- The managed-pricing gate in `app/services/billing.server.ts` should be removed or replaced with a Stripe subscription check.
- `SHOPIFY_BILLING_REQUIRED` should remain `false`. Subscription enforcement is handled outside of Shopify billing.
- Stripe owns the recurring app subscription/payment:
  - recurring per-merchant Stripe subscription
  - optional trial period managed in Stripe
  - app access gated by Stripe subscription state
- Stripe is also used for the optional separately contracted DFY setup fee.
- One Shopify store equals one Stripe subscription.

### Fulfillment Position

The merchant launch is a service workflow, not only an app deployment:

1. Merchant signs onboarding terms.
2. Merchant pays DFY setup fee via Stripe, if offered.
3. App and theme integration is tested on a dev store using the shared staging backend.
4. New Partners Dashboard custom app entry is created for the merchant and credentials are added to that merchant's Fly.io app environment.
5. Merchant storefront build happens on a client transfer store, or directly on a merchant-owned store through collaborator access.
6. Big Bang theme is customized and QA'd with the merchant catalog.
7. Merchant approves the preview store.
8. If using a client transfer store, ownership is transferred to the merchant.
9. Merchant accepts transfer and chooses a Shopify plan.
10. Merchant installs Producer Launchpad via their unique custom install link.
11. App setup, metaobjects, product publishing, storage, delivery email, and checkout delivery are verified on the live store.
12. Stripe subscription is created for the merchant's live `*.myshopify.com` domain.
13. Store goes live with custom domain, app, theme, checkout delivery, and email delivery working.

## Multi-Merchant Deployment Architecture

### Infrastructure Layout

Each merchant gets their own Fly.io app (`producer-launchpad-{slug}.fly.dev`) with their own Shopify app credentials and env vars. All apps can share one Postgres database because app data is already scoped by `shop` field in every model.

```
Partners Dashboard
  - App Entry: Producer Launchpad - Merchant A  (apiKey_A, apiSecret_A) -> https://producer-launchpad-merchant-a.fly.dev
  - App Entry: Producer Launchpad - Merchant B  (apiKey_B, apiSecret_B) -> https://producer-launchpad-merchant-b.fly.dev
  - App Entry: Producer Launchpad - Merchant C  (apiKey_C, apiSecret_C) -> https://producer-launchpad-merchant-c.fly.dev

Fly.io
  - producer-launchpad-merchant-a.fly.dev   (SHOPIFY_API_KEY=A, SHOPIFY_API_SECRET=A)
  - producer-launchpad-merchant-b.fly.dev   (SHOPIFY_API_KEY=B, SHOPIFY_API_SECRET=B)
  - producer-launchpad-merchant-c.fly.dev   (SHOPIFY_API_KEY=C, SHOPIFY_API_SECRET=C)
    all share DATABASE_URL -> same Postgres

PostgreSQL
  - producer-launchpad-db  (shared, all merchants, scoped by shop field)
```

Each Partners Dashboard app entry points to its corresponding Fly.io app URL.

### Code Update Process

When a new version is deployed, run all merchant apps in parallel:

```bash
#!/bin/bash
# deploy-all.sh
APPS=(
  "producer-launchpad-merchant-a"
  "producer-launchpad-merchant-b"
  "producer-launchpad-merchant-c"
)

for app in "${APPS[@]}"; do
  fly deploy --app "$app" &
done

wait
echo "All merchant apps deployed."
```

---

## Per-Merchant Onboarding Runbook

Complete these steps for every new merchant before sending them an install link.

### Step 1 - Create Partners Dashboard App Entry (~5 min)

1. Go to [partners.shopify.com](https://partners.shopify.com) -> Apps -> Create app -> Create app manually.
2. Name it `Producer Launchpad - [Merchant Name]`.
3. Set App URL to a placeholder (`https://example.com`) for now.
4. Save and copy the `API key` and `API secret key`.

### Step 2 - Spin Up Fly.io App (~5 min)

```bash
# Create the app (replace {slug} with a short merchant identifier, e.g. merchant-johndoe)
fly apps create producer-launchpad-{slug}

# Set all required secrets
fly secrets set --app producer-launchpad-{slug} \
  SHOPIFY_API_KEY=<from Partners Dashboard> \
  SHOPIFY_API_SECRET=<from Partners Dashboard> \
  DATABASE_URL=<shared postgres URL> \
  SHOPIFY_APP_URL=https://producer-launchpad-{slug}.fly.dev \
  SHOPIFY_APP_SCOPES=read_products,write_products,read_publications,write_publications,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_orders,write_app_proxy \
  ENCRYPTION_KEY=<same shared key> \
  RESEND_API_KEY=<resend key> \
  DELIVERY_EMAIL_FROM=<from address> \
  INTERNAL_JOB_SECRET=<shared secret>
  # add any other env vars from .env.example

# Deploy
fly deploy --app producer-launchpad-{slug}
```

### Step 3 - Update Partners Dashboard App Entry (~2 min)

1. Back in Partners Dashboard, open the app entry created in Step 1.
2. Update App URL to `https://producer-launchpad-{slug}.fly.dev`.
3. Add Allowed redirection URL: `https://producer-launchpad-{slug}.fly.dev/auth/callback`.
4. Save.

### Step 4 - Send Install Link

1. In Partners Dashboard -> the merchant's app entry -> Distribution -> copy the shareable install link.
2. Send to merchant. They click it, authenticate with their Shopify store, and the app installs.

### Step 5 - Post-Install Verification

- Confirm a `Session` row exists in the database for the merchant's `shop` domain.
- Open the embedded app from the merchant's Shopify admin and verify the setup checklist loads.
- Confirm webhooks are registered: `APP_UNINSTALLED`, `ORDERS_CREATE`, `ORDERS_PAID`, and privacy webhooks.
- Run one test order to verify delivery access is created and the download portal works.

---

## Testing the Multi-Merchant Setup

This section covers how to verify the custom distribution multi-merchant architecture before onboarding real merchants.

### Prerequisites

- Two Fly.io apps deployed against the same staging/dev Postgres database.
- Two Partners Dashboard app entries, each pointing to one of the Fly.io apps.
- Two Shopify dev stores (or one dev store and one development store under a different account).

### Test 1 - Independent Authentication

1. Install Merchant A's app on Dev Store A using Merchant A's install link.
2. Install Merchant B's app on Dev Store B using Merchant B's install link.
3. Open the embedded app from each admin separately.
4. Verify both stores reach the app home without auth errors.
5. Verify the session table contains separate rows scoped to each `shop` domain.

**Pass:** both stores authenticate independently with no credential collision.

### Test 2 - Data Isolation

1. From Dev Store A: create a beat draft, configure storage, or save any app data.
2. Open the embedded app from Dev Store B.
3. Verify none of Dev Store A's data is visible in Dev Store B's app session.

**Pass:** every app surface (Beats, Licenses, Deliveries, Settings) shows only data scoped to the active `shop`.

### Test 3 - Webhook Isolation

1. Place a test order on Dev Store A.
2. Confirm the `orders/paid` webhook fires and creates a `DeliveryAccess` row scoped to Dev Store A's shop domain.
3. Open Dev Store B's Deliveries page and confirm the order does not appear.

**Pass:** webhook events are processed and scoped correctly per store.

### Test 4 - Code Update Across Merchants

1. Make a visible UI change (e.g., a label on the home page).
2. Run `fly deploy --app producer-launchpad-merchant-a && fly deploy --app producer-launchpad-merchant-b`.
3. Reload the embedded app for both stores.

**Pass:** both merchants see the updated UI; no downtime or session loss occurs during deploy.

### Test 5 - Merchant Uninstall + Reinstall

1. Uninstall Merchant A's app from Dev Store A.
2. Verify the `APP_UNINSTALLED` webhook fires and the shop deletion job is queued.
3. Reinstall using the same install link.
4. Verify a fresh session is created and the app loads cleanly.

**Pass:** uninstall and reinstall complete without leaving orphaned sessions or broken state.

### Test 6 - Full End-to-End Order Flow Per Merchant

For each merchant store independently, complete the existing end-to-end checkout matrix from Phase 3 Final QA:
- single-file license order
- multi-file ZIP order
- merchant recovery actions (copy portal link, regenerate token, resend email)

**Pass:** both merchants can complete the full customer and merchant flow with no cross-contamination.

---

## Current Code Reality

### Completed Items

- App IA/home rebuild is mostly complete in code:
  - `/app` owns `Get started` for incomplete setup and `Overview` for ready stores.
  - permanent `Settings`, `Beats`, `Licenses`, and `Deliveries` surfaces exist.
  - legacy `/app/setup` and `/app/storage` route ownership has been demoted.
- Beat upload is no longer the old placeholder flow:
  - draft and active save states exist.
  - upload validation checks active readiness before publish.
  - Beats index reads Shopify products and local drafts instead of returning `beats: []`.
  - Beats index marks catalog items `Ready`, `Needs attention`, or `Draft`.
- Delivery automation is implemented in app code:
  - `orders/create` webhook creates orders, order items, delivery access, executed agreements, and delivery emails.
  - tokenized download portal exists.
  - secure file downloads are authorized by delivery token and purchased variant mapping.
  - multi-file audio delivery uses ZIP bundles.
  - PDF agreement generation exists from executed agreement snapshots.
  - download counts are tracked for purchased files.
- Merchant recovery tools exist in `Deliveries`:
  - copy portal link.
  - regenerate access link.
  - resend delivery email.
  - delivery email status and confirmed Resend states are represented.
- Resend delivery email V1 exists:
  - automatic order email.
  - manual resend.
  - optional webhook-confirmed status mode behind `RESEND_WEBHOOKS_ENABLED`.
- Privacy and deletion foundation is implemented:
  - Shopify compliance webhooks route through `/webhooks`.
  - `customers/data_request`, `customers/redact`, and `shop/redact` logic exists.
  - managed-storage deletion jobs are queued for uninstall and shop redact.
  - hosted staging evidence in `docs/PRE_SUBMISSION_CHECKLIST.md` marks real privacy webhook delivery complete.
- App production URL config has the base single-app default in place, but per-merchant launch requires templated config:
  - each merchant Partners Dashboard app entry points to `https://producer-launchpad-{slug}.fly.dev`.
  - each merchant Fly.io app sets `SHOPIFY_APP_URL=https://producer-launchpad-{slug}.fly.dev`.
  - deployment docs exist for Fly and Render.
- Theme/storefront integration exists:
  - product page reads `custom.beat_licenses` and variant `custom.license_reference`.
  - license selector and stems add-on UI are wired to storefront product data.
  - cart and cart drawer require license agreement consent before checkout.
  - cart attributes capture order-level agreement acceptance.

### In-Progress Items

- Hosted production validation is still the launch-critical gap.
- The checkout thank-you extension fetches delivery status directly from the Fly app with session-token auth. It is verified on staging, but the production resolver must be checked against the per-merchant Fly.io URL model before the first merchant launch.
- The Shopify managed-pricing UX exists in code but no longer matches the custom-distribution launch path.
- `SHOPIFY_BILLING_REQUIRED=false` remains the correct environment posture for custom-distribution apps.
- Stripe subscription gating still needs to replace the dormant Shopify billing gate before paid launch.
- Production environment variables and Resend sender/domain values still need a final hosted-environment check.
- Brand/domain cutover is needed: offer name changes to `Producer Build`, app name changes to `NRS`, parent brand is `nrs.sound`, and the new email/domain asset is `producerbuild.com`.
- The app and theme have to be verified together against real Shopify checkout, not only local app behavior.

### Blockers / Unknowns

- Production install of the checkout extension still needs to be deployed and verified for each merchant app entry on a real production order.
- Unknown whether the live theme has the current launch-ready Liquid files deployed.
- Unknown whether production secrets are fully set:
  - `DATABASE_URL`
  - `SHOPIFY_APP_URL`
  - `RESEND_API_KEY`
  - `DELIVERY_EMAIL_FROM`
  - `RESEND_WEBHOOK_SECRET` if webhook tracking is enabled
  - R2 credentials
  - `INTERNAL_JOB_SECRET`
  - Stripe keys, price IDs, and webhook secret if Stripe gating is implemented before launch
- Unknown whether the recurring deletion-job trigger is configured in production.
- Open commercial decisions remain:
  - exact optional DFY setup fee
  - exact monthly subscription amount
  - annual discount or no annual option
  - tiered plans or one plan
  - CRM/pipeline source of truth
  - whether setup fee and recurring subscription are separate Stripe products or combined in a single sales/onboarding flow.

## Launch Definition

Producer Launchpad is launched when a real merchant can be sold, onboarded, built, transferred, billed, and supported without breaking the customer checkout/download flow.

The customer-facing definition remains:

- A real customer can buy a beat on the live Big Bang Shopify storefront.
- The customer receives the correct licensed files and agreement without manual intervention.
- The merchant can recover or resend delivery access from the app without database access.

The merchant-facing DFY definition adds:

- Setup fee is collected before build work begins.
- The merchant build is completed on a client transfer store or merchant-owned store.
- The app and Big Bang theme are configured together.
- Store transfer and post-transfer app install are handled cleanly.
- Stripe subscription/trial state is recorded against the live shop domain.
- The merchant receives go-live, trial-end, and billing-start communication.

### App Requirements

- App is deployed on a stable hosted URL.
- Shopify app config, redirect URLs, app proxy, and webhook URLs all point to the hosted app.
- Database migrations are applied in production.
- Required app secrets are set in the hosted environment.
- R2 storage upload and download work for launch products.
- Resend sends delivery emails from the correct launch sender.
- `SHOPIFY_BILLING_REQUIRED` remains `false` for custom-distribution environments.
- Settings subscription UI uses Stripe subscription status and reactivation/payment links.
- Stripe billing behavior is verified before merchant handoff.
- `orders/create` webhook creates:
  - order record.
  - delivery access token.
  - order items.
  - executed agreement snapshot/PDF.
  - delivery email state.
- Download portal works without exposing embedded app shell.
- Deliveries page supports merchant recovery without direct database access.
- Privacy compliance webhooks and shop deletion queue remain operational.

### Theme / Storefront Requirements

- Live theme product pages show sellable beat products created by the app.
- Product page license selector reads app-created license metaobjects and variant license references.
- Product page add-to-cart selects the correct variant and stems add-on behavior.
- Cart and cart drawer require license agreement consent before checkout.
- Order-level consent attributes are captured at checkout.
- Staging agreement-proof contract remains valid in production:
  - `_pl_*` line item properties are captured when applicable.
  - order-level agreement attributes are captured.
- Storefront audio preview, product image, price, and license details render correctly for launch products.
- Theme deployment path is clear before merchant transfer.

### End-To-End Customer Flow Requirements

- Customer opens a live beat product.
- Customer selects a license and optional stems add-on where applicable.
- Customer adds to cart and accepts license agreement consent.
- Customer completes checkout.
- Thank-you block opens the download portal from the merchant Fly.io app URL.
- Delivery email arrives with the same production portal URL.
- Portal shows every purchased beat in the order.
- Single-file license downloads correctly.
- Multi-file license downloads as a ZIP.
- PDF agreement downloads correctly.
- Customer-facing error states are understandable if a token, mapping, or file is missing.

## Phase 1 - Product Launch Readiness

This phase proves the app/theme product works on the live stack.

| Owner | Task | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| App | Replace the checkout thank-you extension's hardcoded staging URL with a deploy-safe resolver. | Done | `ThankYouBlock.tsx` resolves the Fly app URL at runtime via `api.shop.myshopifyDomain`. Direct fetch plus session token; backend route `app/routes/api.checkout.delivery-status.tsx`. Verified end-to-end on staging. |
| App | Deploy the checkout extension to the merchant Shopify app entry. | Required | `npm run shopify -- app deploy --config <merchant-prod>` and verify a real production order surfaces the download portal button. |
| App/Ops | Confirm production app deployment and app config. | Required | Merchant Fly.io app responds; Shopify app URL and redirect URLs match `https://producer-launchpad-{slug}.fly.dev`; install/reinstall/auth callback work. |
| App/Ops | Confirm production database migration. | Required | `npm run db:migrate:deploy` has run successfully against production PostgreSQL. |
| App/Ops | Confirm production secrets. | Required | App can authenticate Shopify, read/write products/metaobjects, send Resend email, access R2, and trigger internal deletion jobs. |
| App | Replace Shopify billing gate with Stripe subscription check. | Required | `SHOPIFY_BILLING_REQUIRED=false`; Settings subscription card reflects Stripe billing status and payment/reactivation links. |
| Theme | Verify product page uses app-created product, variant, and license metaobject data. | Done | Staging "May 17 in PHX" product renders all three license tiers with correct pricing and delivery package details from `custom.beat_licenses` / `custom.license_reference`. |
| Theme/App | Verify agreement proof contract between theme and app. | Done | Staging order #1025 contains both `_pl_*` line item properties and order attributes. |
| Theme | Verify cart and cart drawer consent gating. | Done | Cart drawer checkout button is disabled with consent unchecked and active only when agreement consent is checked. |
| App | Verify webhook processing on a real live/staging order. | Done | Staging orders produced a `DeliveryAccess` row, executed agreement snapshot, downloadable portal, and PDF agreement. |
| App | Verify delivery files are mapped for each launch license. | Done | Unlimited license order delivered MP3, WAV, and STEMS via portal ZIP bundle. |
| App | Verify PDF generation for the launch product. | Done | "View agreement" produced a complete Unlimited License PDF with licensor/licensee/order/IP metadata for staging order #1025. |
| App | Verify download portal file authorization. | Done | Portal works in incognito. All purchased files download cleanly via ZIP bundle. |
| App/Ops | Verify recurring shop-deletion processing. | Required | Internal endpoint is protected by `INTERNAL_JOB_SECRET` and has a scheduled trigger or documented manual launch-day operation. |

## Phase 2 - DFY Billing + Fulfillment Readiness

This phase proves a merchant can move from sale to live store.

| Owner | Task | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| Business/Ops | Confirm custom distribution multi-merchant path. | Done | One Partners Dashboard app entry per merchant, one Fly.io app per merchant, shared Postgres database, Stripe billing. |
| Business/Ops | Finalize optional DFY setup fee and Stripe app subscription pricing. | Required | Setup fee and monthly subscription amounts are set; both are billed through Stripe. |
| App/Ops | Replace Shopify billing gate with Stripe subscription check. | Required | `app/services/billing.server.ts` enforces access via Stripe subscription state, not Shopify billing status. `SHOPIFY_BILLING_REQUIRED` remains `false`. |
| App/Ops | Enable v1 subscription enforcement path. | Required | Authenticated routes gate paid access through Stripe subscription status. |
| App | Remove Shopify managed-pricing UX from Settings. | Required | Settings subscription card reflects Stripe subscription status and links, not Shopify billing flow. |
| Ops | Write per-merchant onboarding runbook. | Done | See Per-Merchant Onboarding Runbook section above. |
| Ops | Write deploy-all script for code updates. | Required | `deploy-all.sh` lists all active merchant Fly.io app names and deploys in parallel. |
| Ops | Pick CRM/pipeline source of truth. | Required | Merchant statuses exist for `Paid - Build Pending`, `Build In Progress`, `Preview Sent`, `Transfer Pending`, `Live - Trial Active`, `Live - Active`, and `Payment Issue`. |
| Ops | Write merchant communication templates. | Required | Templates cover setup payment, build confirmation, preview approval, transfer instructions, install URL, trial start, trial day 25, and first charge. |
| App/Ops | Complete Producer Build / NRS brand and email-domain cutover. | Required | Shopify app entry name uses `NRS`; offer/merchant-facing copy uses `Producer Build`; parent brand references use `nrs.sound`; `producerbuild.com` is configured and verified in Resend; sender display/name and `DELIVERY_EMAIL_FROM` use the approved launch sender. |
| Ops | Write store-build and transfer runbook. | Required | Runbook separates dev-store app QA from client transfer store build; covers transfer, Shopify plan selection, collaborator access, post-transfer app install from custom install link, and custom domain handoff. |
| App/Theme | Build first merchant storefront. | Required | Big Bang theme, catalog, and storefront preview pass QA before transfer; app-dependent setup is queued for post-transfer install. |
| App/Ops | Verify post-transfer install. | Required | After ownership transfer, merchant installs from custom install link and a fresh valid session exists in Prisma. |
| App/Ops | Complete multi-merchant setup tests. | Required | All six tests in the Testing section pass against two separate dev stores. |

## Phase 3 - Final QA, Deployment, and Handoff

### Final QA

| Owner | Task | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| App | Run app build and lint. | Pending | `npm run build` passes; `npm run lint` passes or only known non-launch warnings remain. |
| Theme | Smoke-test live product pages on desktop and mobile. | Pending | Product image, audio preview, license selector, price, stems option, and CTA render correctly. |
| Theme | Smoke-test cart and cart drawer on desktop and mobile. | Pending | Consent gating, order attributes, and checkout redirect work in both cart surfaces. |
| App/Theme | Place a single-file license order. | Pending | Thank-you block, delivery email, portal, PDF, and single-file download all pass. |
| App/Theme | Place a multi-file license order. | Pending | Thank-you block, delivery email, portal, PDF, and ZIP download all pass. |
| App/Theme | Place a multi-beat checkout order. | Pending | One portal is created; portal shows all items; Deliveries item popover/grouping is accurate. |
| App | Test merchant recovery actions. | Pending | Copy portal link, regenerate access link, old-token invalidation, and resend email all pass. |
| App | Test customer-facing failure states. | Pending | Invalid token, missing file mapping, partial delivery, and missing downloadable items are understandable. |
| App/Ops | Verify privacy webhooks still route after production deploy. | Pending | A known hosted environment receives `customers/data_request`, `customers/redact`, and `shop/redact` with `200` responses, or existing staging evidence is accepted for launch. |
| App/Ops | Verify billing handoff. | Pending | Stripe subscription/trial state is visible and app access reflects active/inactive billing correctly before go-live. |

### Deployment Steps

1. Freeze app and theme launch scope.
2. Deploy checkout extension to the merchant's Shopify app entry.
3. Deploy the shared repo to the merchant Fly.io app.
4. Run production database migrations.
5. Confirm Shopify app config and Partner Dashboard URLs.
6. Deploy or publish the launch theme version.
7. Confirm `producerbuild.com` Resend domain, sender display/name, reply-to, and webhook mode.
8. Confirm R2 credentials and file access.
9. Confirm Stripe setup fee and recurring subscription setup.
10. Run the end-to-end checkout matrix.
11. Record non-blocking issues in Post-Launch Cleanup / Prep.

### Merchant Handoff Steps

1. Collect setup fee.
2. Create merchant client transfer store, or confirm collaborator access to the merchant-owned store.
3. Customize Big Bang theme and catalog.
4. Send preview to merchant.
5. Get merchant approval.
6. Transfer store ownership.
7. Merchant accepts transfer and chooses Shopify plan.
8. Install Producer Launchpad app on the merchant-owned live store.
9. Run app setup and verify metaobjects, products, storage, checkout delivery, license PDF, and delivery email.
10. Confirm Stripe subscription/trial for live shop domain.
11. Point custom domain and go live.
12. Send trial-start confirmation with trial end and billing start dates.

## Launch Checklist

- [ ] Merchant Fly.io app URL is live and stable.
- [ ] Merchant Shopify app config uses the merchant Fly.io URL.
- [ ] Checkout thank-you block uses the merchant Fly.io URL.
- [ ] `SHOPIFY_BILLING_REQUIRED=false` is confirmed for custom-distribution environments.
- [ ] Settings subscription UI matches Stripe billing.
- [ ] Stripe setup-fee product/link exists, if offered.
- [ ] Stripe subscription product/pricing exists with selected trial behavior.
- [ ] V1 Stripe subscription enforcement path is implemented and verified.
- [x] Distribution strategy is decided: custom distribution, one Partners Dashboard app entry per merchant, one Fly.io app per merchant, shared Postgres.
- [ ] Live theme product page renders app-created license data.
- [ ] Cart consent blocks checkout until accepted.
- [ ] Order agreement proof is captured.
- [ ] Production database migrations are applied.
- [ ] Resend production email sends successfully.
- [ ] `producerbuild.com` is verified in Resend and `DELIVERY_EMAIL_FROM` uses the approved launch sender.
- [ ] App/offer branding is updated: app name `NRS`, offer name `Producer Build`, parent brand `nrs.sound`.
- [ ] Delivery email portal link opens production portal.
- [ ] Thank-you block portal link opens production portal.
- [ ] Single-file audio download works.
- [ ] Multi-file ZIP download works.
- [ ] PDF agreement download works.
- [ ] Deliveries page shows email state, token state, customer, items, and downloads.
- [ ] Merchant can copy portal link.
- [ ] Merchant can regenerate token and old token becomes invalid.
- [ ] Merchant can resend delivery email.
- [ ] Customer-facing error states are acceptable.
- [ ] Privacy webhook/deletion posture is accepted for launch.
- [ ] Dev-store app QA and client-transfer-store build runbooks are separate and ready.
- [ ] Post-transfer app install is verified.
- [ ] Merchant communication templates are ready.
- [ ] No delivery-critical flow depends on preview, tunnel, or staging URLs.

## What We Are Not Doing For This Launch

- Shopify Billing API (not available for custom distribution apps).
- Public App Store listing (limited visibility or otherwise).
- App Store review submission.
- Self-serve merchant onboarding.
- Theme compatibility with arbitrary third-party themes.
- Multi-credential single-deployment OAuth layer (deferred; optional if merchant volume grows beyond ~10/month).
- Automated Partners Dashboard app entry creation (manual per-merchant, ~10 min total per onboarding).

## Post-Launch Cleanup / Prep

These items are useful but should not block the DFY launch unless they become directly tied to a failing merchant onboarding, checkout, billing, or delivery flow.

- Billing hardening:
  - add richer Stripe billing state in Settings.
  - add dunning/status messaging for inactive or cancelled stores.
  - add internal billing diagnostics.
- Deeper legal/PDF cleanup:
  - continue [LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md](/Users/payan/producer-launchpad-app/LICENSE_PDF_AND_METAOBJECT_FOLLOWUP.md).
  - refine license snapshot architecture.
  - decide long-term PDF attachment strategy for emails.
  - improve customer-facing legal preview/download polish.
- Product/IA cleanup:
  - archive old IA comparison docs more aggressively.
  - finish dedicated nested license editor route if still valuable.
  - add deeper Beats-to-Licenses navigation polish.
  - remove obsolete wireframes or move them under historical reference.
- Delivery/security enhancements:
  - token expiration.
  - rate limiting and abuse protection.
  - customer self-serve recovery page.
  - richer delivery diagnostics.
  - merchant-branded sender domains.
  - broader monitoring and alerting.
- Privacy operations:
  - remove or further gate internal privacy test tooling after verification.
  - automate privacy maintenance on a more explicit schedule if stronger time-bound claims are made.
  - maintain deletion-job runbook.
- Theme enhancements:
  - refine license trust-pill UX.
  - improve collection/grid CRO.
  - clean up product-grid implementation branches.
  - remove production debug logging where applicable.
- Future distribution rethink:
  - build multi-credential single-deployment OAuth layer when per-merchant Fly.io app management becomes a real bottleneck (roughly 10+ active merchants).
  - revisit public App Store listing only if self-serve tier becomes a priority and the audio player is rebuilt as a theme app extension.
  - revisit Shopify billing only if public distribution is pursued.

## Risks / Blockers

- The checkout extension source is fixed and verified on staging; the production bundle must still be deployed and tested against a real production order before launch.
- Hosted validation is still the largest product risk. The flow must be tested on real Shopify checkout after deploy.
- Production secrets may be incomplete or inconsistent with staging. Each merchant Fly.io app needs its own full set of secrets.
- Resend webhook-confirmed statuses should stay disabled unless the webhook URL and secret are verified.
- The deletion queue requires either a scheduled trigger or a launch-day operational runbook.
- Theme deployment should be checked against the live store before handoff.
- Public privacy/terms wording must not promise stronger automation or retention behavior than the app actually provides.
- The deploy-all.sh script must be kept up to date as new merchant apps are added - a stale list means a merchant misses a code update.
- Each new merchant Fly.io app URL must be set correctly in both the Fly.io environment (`SHOPIFY_APP_URL`) and the Partners Dashboard app entry before the install link is sent.

## Final Launch Checklist

- [x] Confirm custom distribution multi-merchant launch model.
- [ ] Finalize DFY setup fee and Stripe app subscription pricing.
- [ ] Replace Shopify billing gate with Stripe subscription check.
- [ ] Fix Settings subscription UI to reflect Stripe status.
- [ ] Complete Producer Build / NRS brand cutover and Resend `producerbuild.com` sender setup.
- [ ] Deploy checkout thank-you block production bundle.
- [ ] Confirm production app deploy, secrets, and migrations.
- [ ] Write deploy-all.sh script and test against two merchant apps.
- [ ] Complete all six multi-merchant setup tests (see Testing section).
- [ ] Confirm live theme product page reads app-created license data.
- [ ] Confirm cart consent and agreement-proof capture.
- [ ] Complete one single-file order test.
- [ ] Complete one multi-file/ZIP order test.
- [ ] Complete one multi-beat order test.
- [ ] Confirm delivery email, portal, PDF, and file downloads.
- [ ] Confirm merchant recovery actions in Deliveries.
- [ ] Confirm privacy/deletion operational posture.
- [ ] Prepare dev-store QA, client-transfer build, post-transfer install, and go-live runbooks.
- [ ] Freeze scope and launch first DFY merchant.
