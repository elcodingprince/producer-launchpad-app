# Producer Launchpad Privacy Policy Draft

Draft status: implementation-aligned working draft based on the codebase reviewed on April 5, 2026.

Use this draft for legal review. It is written to match the current code as closely as possible and avoids promises the app does not yet implement.

## Quick Summary

- Producer Launchpad processes merchant, order, and limited customer data to generate music license records, create secure delivery links, and send delivery emails.
- The app receives most customer and order data from Shopify webhooks and Shopify Admin API calls.
- The app currently uses Shopify, Cloudflare R2, Resend, and the app hosting environment shown in configuration (`fly.dev`) to operate the service.
- Customer deletion and shop deletion requests sent by Shopify are handled through Shopify compliance webhooks.
- Customer data request webhooks are captured automatically, and Producer Launchpad support completes fulfillment for the store owner within Shopify's required timeframe.
- Some data has a specific 90-day cleanup window in code. Core order, delivery, and sold-license records are retained while the merchant actively uses the app.
- Merchant-uploaded files stored in Producer Launchpad managed storage are queued for deletion immediately after uninstall and removed within 7 days.
- If merchants need copies of their files or transaction records, they should save them before uninstalling the app.

## What We Process

### Merchant data

We process:

- Shopify shop domain
- app session and installation data
- merchant legal identity and licensing configuration used to generate agreements
- merchant storage configuration and delivery settings
- merchant beat catalog and delivery mapping data
- merchant acknowledgment records that show when required in-app disclosures were accepted

### Customer and order data

We process:

- customer email address
- customer name when Shopify provides it
- Shopify customer ID when Shopify provides it
- Shopify order IDs, order numbers, line items, and purchased license details
- download counts for delivered files
- secure delivery token tied to an order

### Agreement and support data

We process:

- rendered agreement HTML
- generated agreement PDFs when PDF generation succeeds
- accepted license metadata, template version, hash, and acceptance-proof details
- delivery email status, sent timestamp, recipient, provider message ID, and related troubleshooting fields

### Limited technical metadata

We process:

- browser IP address
- user agent
- browser language

We do not use customer data for advertising, cross-merchant profiling, or resale.

## Where The Data Comes From

Producer Launchpad receives data from:

- Shopify app install and embedded app sessions
- Shopify `orders/create` webhooks
- Shopify Admin API calls used to resolve license, order, and product details
- merchant actions inside the app, including uploads and configuration changes
- Resend webhook events about delivery email status

## Why We Use The Data

We use data to:

- create a record of the license terms sold with a purchase
- identify the buyer on the generated license agreement when needed
- create a secure download portal for purchased files
- send delivery emails and support re-delivery
- troubleshoot delivery failures
- respond to Shopify privacy compliance webhooks
- maintain app operations and merchant support

## Sharing And Service Providers

Producer Launchpad shares data only as needed to operate the service.

Based on the reviewed code, the named providers are:

- Shopify, for storefront, order, customer, webhook, and admin API data
- Cloudflare R2, for uploaded audio files, stems, cover art, and other delivery assets
- Resend, for delivery emails and email event webhooks
- Fly.io, as the configured hosted application URL in the app configuration files

Producer Launchpad does not sell customer personal data.

## Retention And Deletion

The following statements match the current code behavior.

### Data with a 90-day cleanup window

- Browser IP address, user agent, and browser language stored on orders are cleared after 90 days.
- Buyer IP address and user agent stored on executed agreement records are cleared after 90 days.
- Delivery email troubleshooting fields such as recipient, provider message ID, error text, last event, and last event timestamp are cleared after 90 days.
- Fulfilled privacy request records are deleted 90 days after they are marked fulfilled.

This cleanup runs when the shop receives a webhook handled by the app or when the merchant opens the embedded app. The reviewed code does not include a separate scheduled job, so cleanup is event-driven rather than clock-driven.

### Data kept until a deletion trigger happens

- Core order, delivery, and sold-license agreement records are retained while the merchant actively uses Producer Launchpad so the app can preserve fulfillment history, support merchants, and maintain sold-license proof.
- Customer email may remain in delivery and agreement records until a valid customer redaction request is received.
- Agreement HTML and PDF records may remain until a valid customer redaction request, app uninstall, or shop redaction request is received.

### Deletion triggers currently implemented

- `customers/redact`: customer identifiers are removed from matching order, delivery, privacy-request, and agreement records. The app preserves a redacted agreement artifact as proof of the transaction.
- `shop/redact`: shop-scoped app records are deleted from the app database after managed-storage uploads are queued for deletion.
- `app/uninstalled`: managed-storage uploads are queued for deletion immediately, then shop-scoped app records are deleted from the app database.
- Draft beat records can also be deleted manually from the app.

### Managed storage note

- Merchant-uploaded files stored in Producer Launchpad managed storage are queued for deletion immediately after uninstall and permanently removed within 7 days.
- Shop-scoped app records deleted through uninstall or `shop/redact` include merchant acknowledgment records, sessions, orders, delivery records, uploaded-file records, drafts, storage settings, and privacy request records.
- If merchants need copies of their files or transaction records, they should save them before uninstalling because Producer Launchpad is not intended to remain the merchant's long-term records custodian after the service ends.

## Shopify Privacy Rights Handling

Producer Launchpad supports Shopify compliance webhooks for:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

### Customer data requests

When Shopify sends a `customers/data_request` webhook, the app automatically:

- finds matching orders using Shopify customer ID, customer email, and any requested order IDs
- creates a structured export payload inside the app database
- prepares that export for support-operated fulfillment to the store owner

Producer Launchpad support completes fulfillment for the store owner within Shopify's required timeframe.

### Customer redaction

When Shopify sends a `customers/redact` webhook, the app automatically removes or anonymizes stored customer data it can match, including:

- Shopify customer ID
- customer name
- customer email in delivery records
- delivery email troubleshooting fields
- browser IP, user agent, and language fields on related orders
- buyer email, buyer IP, and user agent on related agreement records

The app keeps a redacted agreement artifact so the merchant still has a stripped-down record of the transaction.

### Shop redaction and uninstall

When Shopify sends `shop/redact`, or when the app receives `app/uninstalled`, the app deletes the shop's records from the app database, including merchant acknowledgment records, sessions, orders, delivery records, privacy requests, uploaded-file records, drafts, and merchant storage settings. Managed-storage uploads are queued for deletion immediately and removed within 7 days.

Before uninstalling, merchants who need copies of their files or transaction history should save them first.

## Customer Rights

Depending on applicable law and Shopify's merchant-controlled relationship with the buyer, rights may include access, deletion, and portability.

In the current implementation:

- access and portability are supported through Shopify `customers/data_request` webhooks plus support-operated fulfillment to the store owner
- deletion is supported through Shopify `customers/redact`
- shop-level deletion is supported through Shopify `shop/redact`

If you have a privacy question about Producer Launchpad itself, contact `newradio.sound@gmail.com`.

## Security

The reviewed code supports these security-related practices:

- encrypted transport to external providers
- authenticated Shopify admin access for merchant-facing app pages
- signed or token-based access for delivery links and storage operations
- controlled retention and deletion behavior for privacy-related data

No system can guarantee absolute security.

## Merchant Responsibilities

Merchants remain responsible for:

- ensuring their storefront, checkout, and post-purchase disclosures are legally sufficient
- deciding whether they need additional customer-facing privacy disclosures
- fulfilling any obligations they control directly as the seller

## Contact

For privacy-related questions about Producer Launchpad, contact `newradio.sound@gmail.com`.

## Internal Notes For Public Policy Review

Before publishing, verify that the public policy accurately reflects:

- the active-store retention rule for core transaction, delivery, and agreement records
- the service providers you actually use in production
- whether buyer name and/or buyer email remain embedded in retained agreement artifacts
- the correct business entity and contact details
