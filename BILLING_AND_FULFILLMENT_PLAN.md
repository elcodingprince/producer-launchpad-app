# Billing & Fulfillment Plan
## Producer Launchpad - Custom Distribution + Per-Merchant Deployment Model

---

## Overview

Producer Launchpad is a custom theme plus embedded Shopify app system delivered as a done-for-you (DFY) service. The codebase is shared, but each merchant gets their own Shopify Partners Dashboard app entry and their own Fly.io app deployment.

This keeps the launch in Shopify's custom-distribution lane while still letting the same repo power multiple merchant installs:

- one repo
- one custom app entry per merchant
- one Fly.io app per merchant
- one merchant store per custom app entry
- optional shared PostgreSQL database, with all records scoped by `shop`
- Stripe for setup fees and recurring app/service subscription
- no public App Store listing
- no App Store review dependency

Shopify Billing API is not available for custom-distribution apps, so app access and recurring payments are handled outside Shopify through Stripe.

---

## 1. Billing Model

### Why Stripe Billing

Shopify's distribution rules make the split clear:

- Custom distribution is for one store, multiple stores in the same Plus organization, or transfer-disabled development stores.
- Custom-distribution apps cannot use the Billing API to charge merchants.
- Public App Store distribution is the path for one shared app identity installed across unrelated merchants, but that brings App Store review and Shopify billing obligations.

Since Producer Launchpad will use a separate custom app entry and separate Fly.io deployment per individual merchant, the launch model is:

`custom distribution + per-merchant app identity + per-merchant Fly.io app + Stripe billing`

The existing `SHOPIFY_BILLING_REQUIRED=false` setting should remain false for custom-distribution environments. Subscription enforcement should be handled through Stripe, not Shopify billing.

### Payment Structure

**Payment 1 - DFY Setup / Theme Service Fee**

- Type: One-time setup or service payment
- Suggested rail: Stripe Checkout, Stripe invoice, or contract payment
- Purpose: Covers DFY build, theme customization, catalog setup, onboarding work, and launch support
- Collected before fulfillment begins
- Amount: TBD per pricing tier

**Payment 2 - Producer Launchpad Subscription**

- Type: Recurring Stripe subscription
- Purpose: Ongoing access to the app, theme support, and fulfillment system
- Can include a Stripe-managed trial
- Billed directly through Stripe, not Shopify
- App access is gated through Stripe subscription state

### Per-Store Pricing

Billing is per Shopify store. One active merchant store equals one active Stripe subscription. If a merchant operates multiple unrelated stores and wants Producer Launchpad on each, each store should get its own custom app entry, Fly.io app, and subscription unless a bespoke contract says otherwise.

The shop domain (`*.myshopify.com`) remains the operational identity key for tying a Shopify install to subscription state, delivery data, storage config, and support records.

---

## 2. Fulfillment Workflow

### Phase 1 - Sale & Payment Collection

1. Merchant agrees to onboarding terms and pricing.
2. Send Stripe Checkout link or invoice for the DFY setup fee, if offered.
3. Merchant completes payment.
4. Merchant is added to the internal pipeline with status: **Paid - Build Pending**.

### Phase 2 - Per-Merchant App Setup

5. Create a new Partners Dashboard custom app entry for the merchant.
6. Create a new Fly.io app for the merchant, such as `producer-launchpad-{merchant-slug}`.
7. Set that Fly.io app's env vars with the merchant app's `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, and shared operational secrets.
8. Point the Partners Dashboard app URL and redirect URL to the merchant Fly.io app.
9. Deploy the shared repo to the merchant Fly.io app.

### Phase 3 - Store Build and QA

10. Use a non-transfer dev store for app/theme integration testing.
11. Create a client transfer store for the merchant build, or work directly in a merchant-owned store through collaborator access.
12. Complete the theme build and customization: branding, catalog structure, domain prep, storefront QA, and launch content.
13. Share a preview link with the merchant for approval.
14. Merchant signs off on the build.

Important: Shopify dev stores cannot be transferred to clients. Client transfer stores are the right vehicle for handoff, but custom and draft apps cannot be installed on them while they are still in the Partner organization. App install and app-dependent setup happen after transfer, or inside an already merchant-owned store.

### Phase 4 - Store Transfer

15. In the Shopify Partner Dashboard, initiate store transfer to the merchant if using a client transfer store.
16. Merchant receives the transfer invitation email from Shopify.
17. Merchant accepts the transfer and selects a Shopify plan.
18. The store is now under the merchant's Shopify account.
19. Request or confirm collaborator access for post-transfer app setup and support.

### Phase 5 - App Install and Subscription

20. Send the merchant their unique custom-distribution install link from the merchant-specific app entry.
21. Merchant installs Producer Launchpad and completes OAuth.
22. The app stores a valid Shopify session in Prisma.
23. Create or confirm the merchant's Stripe subscription against the live `*.myshopify.com` domain.
24. Complete app-dependent setup: metaobjects, products, license configurations, storage, delivery email, order webhooks, and checkout extension verification.

### Phase 6 - Go Live

25. Merchant's store goes live: custom domain pointed, app active, theme active.
26. Merchant status updates to **Live - Trial Active** or **Live - Active**.
27. Merchant receives confirmation with subscription/trial dates and support expectations.

---

## 3. Per-Merchant Fly.io Configuration

Each merchant Fly.io app should have its own Shopify credentials and app URL.

Required per-merchant values:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SHOPIFY_APP_SCOPES`

Shared or optionally shared values:

- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `DELIVERY_EMAIL_FROM`
- R2 credentials
- `INTERNAL_JOB_SECRET`
- Stripe keys, price IDs, and webhook secret, depending on how billing is implemented

Recommended naming:

```text
producer-launchpad-{merchant-slug}
https://producer-launchpad-{merchant-slug}.fly.dev
```

The matching Partners Dashboard custom app entry should use:

```text
App URL: https://producer-launchpad-{merchant-slug}.fly.dev
Allowed redirection URL: https://producer-launchpad-{merchant-slug}.fly.dev/auth/callback
```

---

## 4. Stripe Configuration

### Launch Requirements

- Create setup-fee product/payment link or invoice flow, if offered.
- Create recurring subscription product/price.
- Decide whether trial is handled manually or through Stripe trial settings.
- Add Stripe customer/subscription fields to app data model or equivalent operational source of truth.
- Add Stripe webhook handling if subscription gating is automated.
- Replace dormant Shopify billing UI/checks with Stripe subscription status.
- Keep `SHOPIFY_BILLING_REQUIRED=false`.

### Webhook Events To Handle If Automated

| Event | Action |
|---|---|
| `checkout.session.completed` | Confirm setup fee paid or subscription started |
| `customer.subscription.updated` | Sync subscription status |
| `customer.subscription.deleted` | Mark shop inactive and block app access |
| `invoice.payment_succeeded` | Confirm active status and log renewal |
| `invoice.payment_failed` | Mark payment issue and trigger dunning/support flow |

---

## 5. Shopify Ownership Transfer - Full Workflow

### Prerequisites

- You must be a Shopify Partner with the client transfer store under your Partner account, or have collaborator access to an existing merchant-owned store.
- The merchant must have or create a Shopify account.
- The merchant must be prepared to select and pay for a Shopify plan after transfer.

### Transfer Steps

1. Log into the Shopify Partner Dashboard.
2. Navigate to **Stores** and select the client transfer store you built for the merchant.
3. Click **Transfer ownership**.
4. Enter the merchant's email address.
5. Review and confirm the transfer.
6. Merchant receives the transfer invitation email from Shopify.
7. Merchant clicks the invitation link and logs into their Shopify account.
8. Merchant selects a Shopify plan and enters payment details for their Shopify subscription.
9. Transfer is complete; the store is now under the merchant's account.

### What Transfers With the Store

- Theme files and customizations
- Products, collections, metafields, metaobjects
- Pages, navigation, settings
- Order history from development, usually none or test orders
- Domain configurations, with custom DNS still needing merchant action where applicable

### What Does Not Transfer

- A pre-transfer custom/draft app install; custom and draft apps cannot be installed on client transfer stores while they remain in the Partner organization
- OAuth/session data from separate dev-store QA
- The merchant's Shopify plan selection
- Your Partner access unless the merchant grants collaborator access

### Post-Transfer Access

After transfer, request collaborator access from the merchant so you can assist with app install, support, updates, and troubleshooting without store ownership.

---

## 6. Merchant Communication Touchpoints

| Stage | Communication |
|---|---|
| After sale | Setup payment link/invoice + onboarding expectations |
| After payment clears | Build confirmation + estimated timeline |
| Build complete | Preview link for merchant approval |
| Transfer initiated | What to expect email for Shopify plan selection and transfer invite |
| App install | Merchant-specific custom install URL + instructions |
| After install | Stripe trial/subscription confirmation and support expectations |
| Before trial end | Reminder that billing begins soon, if a trial is used |
| First charge | Stripe billing confirmation/support note |

---

## 7. What We Are Not Doing

- One shared custom app identity across unrelated merchants
- Shopify Billing API
- Public or limited-visibility Shopify App Store listing
- App Store review submission
- Self-serve broad-market installs
- Theme compatibility with arbitrary non-custom themes

---

## Open Decisions

- Exact setup service fee, if any
- Exact monthly or annual Stripe subscription pricing
- Whether to offer annual subscription pricing at a discount
- Whether to offer tiered plans based on catalog size, beats, tracks, or license types
- CRM or pipeline tool for tracking merchant onboarding status
- Automated vs. manual sending of setup payment links and install URLs
- Whether Stripe subscription gating ships before the first merchant or is manually enforced for the first launch
