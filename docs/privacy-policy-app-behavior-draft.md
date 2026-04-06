# Producer Launchpad Privacy Policy Draft

Draft status: alignment draft based on current app behavior as validated in staging/dev on April 3, 2026.

This draft is meant to help compare the public privacy policy against the app's actual implementation. Review it with counsel and adjust any business details, subprocessor names, contact details, and retention periods before publishing.

## Overview

Producer Launchpad helps Shopify merchants generate digital music license agreements, manage post-purchase delivery flows, and provide merchants with historical proof of sold licenses.

In providing those services, Producer Launchpad processes merchant data, order data, and limited customer-related data from Shopify and from the merchant's use of the app.

## Data We Process

Producer Launchpad processes the following categories of data.

### Merchant and app account data

- Shopify store domain
- app installation and authentication session data
- merchant-configured app settings, including licensor, catalog, storage, and delivery settings

### Order and transaction data

- Shopify order identifiers and order numbers
- line item and purchased license details
- product, beat, and file-delivery mappings needed to fulfill the purchase
- purchase and agreement timestamps

### Customer-related data

- customer email address
- customer name, when available
- customer-linked agreement identity fields used to identify the licensee on generated agreements

### Delivery and support data

- secure delivery token
- delivery email status and troubleshooting metadata
- limited delivery event metadata needed for support and operational recovery

### Agreement and compliance data

- rendered agreement HTML and/or PDF copies
- agreement version, template, hash, and acceptance-proof metadata
- privacy request records generated when Shopify sends privacy compliance webhooks

### Limited technical metadata

- browser IP address
- user agent
- browser language

Producer Launchpad does not use customer personal data for advertising, cross-merchant profiling, or resale.

## Sources of Data

Producer Launchpad receives data from:

- Shopify APIs and webhooks
- merchant actions taken within the app
- post-purchase events needed to generate agreements and deliver purchased files

## How We Use Data

Producer Launchpad uses data to:

- generate and preserve sold-license agreement records
- identify the licensee on the agreement when required
- connect a purchase to the correct delivery workflow
- generate secure download access for fulfilled purchases
- send delivery emails and support merchant re-delivery workflows
- preserve historical proof of the purchased license terms
- respond to Shopify privacy compliance webhooks and related legal obligations
- detect, investigate, and resolve operational issues

## Data Sharing

Producer Launchpad shares data only as needed to operate the service. This currently includes service providers used for:

- application hosting
- managed database infrastructure
- Cloudflare R2 managed file storage and delivery
- Resend email delivery
- infrastructure operations

Producer Launchpad does not sell customer personal data.

## Retention

Producer Launchpad retains data only for as long as needed to operate the service, support merchants, preserve sold-license proof, and comply with Shopify platform obligations or legal requirements.

Current retention targets are:

- core order, delivery, and sold-license agreement records: retained while the merchant actively uses Producer Launchpad so the app can provide fulfillment history, support merchants, and preserve sold-license proof
- delivery event troubleshooting metadata: retained for up to 90 days
- browser IP, user agent, and similar technical telemetry: retained for up to 90 days
- fulfilled privacy request records and exports: retained for up to 90 days after fulfillment
- merchant-uploaded files stored in Producer Launchpad managed storage: deletion is queued immediately after uninstall and completed within 7 days

If Shopify sends a valid `customers/redact` or `shop/redact` webhook, Producer Launchpad deletes or anonymizes covered data in accordance with that request and the app's compliance workflow.

## Shopify Privacy Compliance

Producer Launchpad supports Shopify privacy compliance webhooks for:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

When Shopify sends a `customers/data_request` webhook, Producer Launchpad automatically records the request, gathers the customer-related data stored by the app, and prepares an export for support-operated fulfillment to the merchant/store owner within Shopify's required time frame.

When Shopify sends a `customers/redact` webhook, Producer Launchpad removes or anonymizes stored customer-related data, including delivery contact data and technical telemetry, while preserving only the minimum agreement-proof records needed for the app's sold-license recordkeeping workflow.

When Shopify sends a `shop/redact` webhook, Producer Launchpad deletes the shop's app data from the app-controlled data stores covered by the webhook workflow.

## Security

Producer Launchpad uses administrative, technical, and organizational measures designed to protect the data it processes, including:

- encrypted transport
- authenticated admin access
- restricted app session handling
- credential protection for configured storage connections
- controlled retention and deletion behavior for privacy-related data

No method of transmission or storage is completely secure, and security cannot be guaranteed absolutely.

## Merchant Responsibilities

Merchants remain responsible for:

- configuring and using the app lawfully
- making any required customer-facing disclosures in their storefront or checkout
- ensuring their own policies and agreements are accurate for their use of Producer Launchpad

## International Processing

Depending on the merchant's configuration and the service providers used to operate Producer Launchpad, data may be processed in countries other than the merchant's or customer's jurisdiction. Where applicable, appropriate contractual or operational safeguards should be used.

## Contact

For privacy-related questions or requests about Producer Launchpad, contact:

- `newradio.sound@gmail.com`

## Internal Notes For Public Policy Review

Before publishing, verify that the public policy accurately reflects:

- the active-store retention rule for core transaction, delivery, and agreement records
- the service providers you actually use in production
- whether buyer name and/or buyer email remain embedded in retained agreement artifacts
- the correct business entity and contact details
