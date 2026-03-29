# Offer Spec

## Market

- Market: Independent artists, producers, and small music brands selling beat licenses and digital file packages through Shopify.
- Ideal customer: A creator with an existing or newly built Shopify storefront who wants a premium licensing and delivery experience without managing file infrastructure, delivery workflows, or legal-document setup manually.
- Trigger event: The client is launching a new storefront, rebranding, or upgrading from a messy manual delivery process that uses DMs, email attachments, Google Drive links, or inconsistent checkout flows.

## Dream Outcome

- Primary transformation: Launch a polished artist or producer storefront that sells licenses cleanly, delivers files automatically, and feels premium to both the merchant and the buyer.
- Time horizon: Storefront setup in days to weeks, with automated fulfillment working immediately after launch.
- Why it matters: The merchant gets a more professional brand, less operational chaos, fewer support headaches, and a store that can sell around the clock without manual follow-up.

## Problems

- Problem 1: Most artists and producers do not want to configure storage, email delivery, file access, legal templates, and Shopify data structures themselves.
- Problem 2: Manual post-purchase fulfillment creates slow delivery, customer frustration, missed sales, and extra support work.
- Problem 3: Existing music storefront setups often look fragmented and do not give the seller confidence that licensing, delivery, and customer access are handled properly.

## Solutions

- Solution 1: Done-for-you storefront setup for a premium music-selling experience built around your custom theme and onboarding process.
- Solution 2: A hosted app that includes storage, file delivery, email notifications, license records, order visibility, and download portal recovery in one place.
- Solution 3: A merchant-facing admin workflow that keeps uploads, delivery status, and license operations simple enough that the seller does not need technical help for day-to-day use.

## Delivery Vehicles

- Delivery model: High-ticket storefront setup fee plus ongoing hosted app subscription.
- Access level: Limited-visibility public Shopify app with Shopify-managed billing for the recurring subscription.
- Fast-win mechanism: Merchant can upload beats, assign licenses, and fulfill orders from one workflow without setting up their own storage stack.
- Risk reduction: Free trial on the app subscription, included storage and delivery capacity, and merchant tools for order lookup, portal regeneration, and email resend.

## Value Stack

- Core offer: Premium artist/producer storefront setup plus Producer Launchpad as the hosted operating layer for licensing, uploads, delivery, and post-purchase management.
- Bonus or support elements: Branded delivery email experience, download portal recovery, delivery visibility, license tracking, and included storage capacity.
- Proof: Cleaner buyer experience, faster fulfillment, fewer support tickets, and less merchant effort compared with manual file delivery workflows.
- Guarantee: Position as a guided launch with a free subscription window, not as an open-ended support promise.

## Pricing

- Price:
  - Storefront setup: $2,000-$5,000 one-time, billed outside Shopify.
  - Default app plan: `Studio` at $99/month after a 30-day free trial.
  - Upgrade plan: `Scale` at $179/month, offered when usage or support needs exceed the standard hosted plan.
- Pricing logic: The setup fee pays for custom storefront buildout and implementation. The recurring fee pays for the hosted app, included storage, delivery email infrastructure, fulfillment tooling, and ongoing operational maintenance.
- Comparison anchor: Cheaper and cleaner than piecing together custom development, storage setup, delivery tooling, and manual support every month.

## Plan Sheet

### Default Plan

- Plan name: `Studio`
- Default plan status: This should be the default public plan.
- Price: $99/month
- Trial: 30-day free trial
- Best fit: Most storefront setup clients
- Includes:
  - Seamless file upload and delivery through the app
  - Automated delivery emails
  - Download portal generation
  - Order and delivery visibility inside the app
  - License and delivery management workflow
  - Portal regeneration and resend-email tools
  - 25 GB included storage
  - One Shopify store
- Fair use limits:
  - Up to 25 GB total managed storage
  - Up to 500 delivery emails per month
  - Up to 1,500 customer file-download actions per month
  - Up to 500 active beat products in the catalog
  - Standard support and normal operational use
- Overage handling:
  - Do not expose overages in-app at launch
  - If a merchant consistently exceeds fair use, move them to `Scale` or a private custom plan

### Upgrade Plan

- Plan name: `Scale`
- Price: $179/month
- Trial: 30-day free trial when sold from the start, otherwise upgrade as needed
- Best fit: Higher-volume stores, heavier delivery usage, or clients who need more support headroom
- Includes everything in `Studio`, plus:
  - More room for larger catalogs and heavier delivery volume
  - Priority support handling
  - 100 GB included storage
- Fair use limits:
  - Up to 100 GB total managed storage
  - Up to 2,500 delivery emails per month
  - Up to 7,500 customer file-download actions per month
  - Up to 2,000 active beat products
  - Priority support

### Private Custom Plan

- Plan name: `Custom`
- Price: Custom
- Best fit: Outlier merchants with unusually large catalogs, heavy download traffic, or special support expectations
- Notes:
  - Keep this off the main public pricing flow
  - Use only when a client clearly exceeds standard unit economics
  - This can be implemented later as a private managed-pricing plan for selected stores

## Risks and Assumptions

- Assumption 1: Most merchants will fall well inside the default hosted plan limits, so a simple flat monthly fee will outperform usage-based pricing early on.
- Assumption 2: Removing bring-your-own-storage will improve onboarding, reduce support burden, and increase perceived product quality more than it increases infrastructure cost.
- Assumption 3: The highest-value clients care more about premium setup, reliability, and reduced effort than shaving a small amount off the monthly fee.

## Next Tests

- Test 1: Sell the offer using `Studio` at $99/month with a 30-day free trial and track objections around price versus setup fee.
- Test 2: Measure real usage for storage, delivery emails, and download traffic across the first few merchants before finalizing long-term fair use thresholds.
- Test 3: Watch whether any merchants actually need `Scale` before exposing it broadly in the pricing UI.
