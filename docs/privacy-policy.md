# Producer Launchpad Privacy Policy

Draft status: internal working draft for review and publishing.

## Overview

Producer Launchpad helps merchants generate digital music license agreements, create secure delivery access for purchased files, and manage post-purchase delivery operations inside Shopify.

This policy describes the customer and merchant data that Producer Launchpad processes, why the data is processed, and how that data is handled.

## Data We Process

Producer Launchpad processes the minimum data needed to operate the app's core functionality.

### Merchant data

- Shopify store domain
- app installation and session data
- merchant-configured catalog, license, storage, and delivery settings

### Customer and order-related data

- customer name, when available and needed to identify the licensee on generated license agreements
- customer email address
- Shopify order identifiers and order numbers
- order line item and license selection details
- delivery status and delivery email status
- limited audit metadata such as browser IP, user agent, and acceptance metadata where the app records that information for agreement and compliance purposes

### Files and generated documents

- generated agreement content and PDFs
- delivery package metadata
- uploaded beat-related files and file mappings

## Why We Process This Data

Producer Launchpad processes customer and order-related data only to:

- associate purchases with buyers
- identify the licensee on generated digital license agreements
- generate and store agreement evidence connected to a purchase
- create secure download access for purchased digital products
- send delivery emails or support re-delivery when needed
- fulfill privacy law and platform compliance obligations

Producer Launchpad does not use customer personal data for advertising, personalization, or cross-merchant profiling.

## Data Sharing and Selling

Producer Launchpad does not sell customer personal data.

Producer Launchpad shares data only as necessary to operate the app and support the merchant's use of the service, such as with hosting, storage, email delivery, or infrastructure providers used to operate the product.

## Merchant Transparency

Merchants are responsible for using Producer Launchpad in a lawful way and for presenting any required consumer-facing disclosures in their storefronts and checkout experiences.

Producer Launchpad discloses to merchants what protected customer data it processes and why.

## Retention

Producer Launchpad retains personal data only as long as needed for:

- digital delivery fulfillment
- merchant support and operational recovery
- agreement evidence
- platform and privacy compliance

Detailed retention targets are described in the internal `data-retention-policy.md` document and should be reflected in production operations before public launch.

## Security

Producer Launchpad is intended to use security controls appropriate to the sensitivity of the data it processes, including:

- encrypted transport
- encrypted storage for protected credentials and production data
- access controls
- environment separation
- incident response procedures

These controls are documented in internal compliance drafts and must be finalized before public submission.

## Customer Rights and Compliance Requests

Producer Launchpad supports Shopify privacy compliance webhooks for:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

Customer data requests received through Shopify are recorded and processed operationally so merchants can fulfill applicable privacy obligations.

## Contact

For privacy-related questions, requests, or support, contact `newradio.sound@gmail.com`.
