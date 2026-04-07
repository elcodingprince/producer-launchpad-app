# Producer Launchpad Merchant Terms Draft

Draft status: implementation-aligned working draft based on the codebase reviewed on April 5, 2026.

This draft is meant to match the app's actual feature set and current privacy workflow. It should be reviewed by counsel before publication.

## Summary

Producer Launchpad is a Shopify app that helps merchants:

- generate music license records tied to Shopify purchases
- create secure download access for purchased files
- send and track delivery emails
- review Shopify privacy request exports and process redaction events

## 1. Service Description

Producer Launchpad provides merchant-facing tools for:

- beat and file upload management
- license-template and delivery-package mapping
- post-purchase license record generation
- customer delivery link creation
- delivery email sending and resend support
- Shopify privacy webhook handling

The service is designed to work with Shopify and relies on Shopify order, product, and customer data to function.

## 2. Merchant Responsibilities

The merchant is responsible for:

- ensuring they have the right to sell, license, and distribute the content they upload
- keeping storefront and support information accurate
- configuring their legal and licensing settings correctly
- reviewing and completing customer data request fulfillment when the app creates a privacy export
- complying with consumer, privacy, music licensing, and ecommerce laws that apply to their business

## 3. Data Handling

Producer Launchpad processes merchant, order, and limited customer data only to provide the service.

That includes:

- merchant account and configuration data
- customer email, customer name when available, and Shopify customer identifiers
- order, line-item, license, and delivery records
- generated agreement records
- limited transaction-related technical metadata

Producer Launchpad does not use merchant customer data for advertising, cross-merchant profiling, or resale.

## 4. Service Providers

Based on the reviewed code, Producer Launchpad currently depends on:

- Shopify
- Cloudflare R2
- Resend
- the configured hosted application environment shown in the app configuration

## 5. Retention And Deletion

The current implementation includes these rules:

- browser IP, user agent, language, and similar technical telemetry are cleared after 90 days
- delivery email troubleshooting fields are cleared after 90 days
- fulfilled privacy request records are deleted 90 days after they are marked fulfilled
- customer redaction and shop redaction requests received through Shopify trigger deletion or anonymization workflows in the app database
- uninstalling the app triggers deletion of shop-scoped records in the app database
- merchant-uploaded files stored in Producer Launchpad managed storage are queued for deletion immediately after uninstall and permanently removed within 7 days
- merchant acknowledgment records are deleted with other shop-scoped app records during uninstall and `shop/redact`

Other records, including agreement records and delivery records, remain until a deletion trigger occurs. The current code does not enforce a separate aging-based deletion schedule for those records.
If merchants need copies of their files or transaction records, they should save them before uninstalling the app.

## 6. Privacy Request Handling

Producer Launchpad supports Shopify privacy webhooks for:

- customer data requests
- customer redaction
- shop redaction

Customer data requests are captured automatically and turned into an export payload inside the app. The current workflow requires merchant review and operational fulfillment; it is not fully automatic end-to-end.

Customer and shop redaction requests are handled automatically in code for app-controlled records.

## 7. Availability And Support

Producer Launchpad may be unavailable from time to time for maintenance, third-party outages, Shopify platform issues, storage-provider issues, or email-provider issues.

Producer Launchpad is not responsible for delays or failures caused by Shopify, Cloudflare, Resend, or the merchant's own configuration.

## 8. Suspension And Termination

Producer Launchpad may suspend or terminate access if needed to protect the service, comply with law, address abuse, or respond to platform requirements.

When the app is uninstalled, the app deletes the shop's records from the app database through the uninstall workflow described above.

Producer Launchpad is not intended to remain the merchant's permanent records custodian after uninstall.

## 9. Disclaimers

Producer Launchpad is provided on an "as is" and "as available" basis to the maximum extent allowed by law.

Producer Launchpad does not guarantee:

- uninterrupted availability
- error-free delivery
- that Shopify, storage, or email providers will always be available
- that generated agreement records are a substitute for merchant-specific legal advice

## 10. Limitation Of Liability

To the maximum extent allowed by law, Producer Launchpad will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost sales, lost data, business interruption, or reputational harm arising out of or related to use of the service.

To the maximum extent allowed by law, Producer Launchpad's total liability for claims arising out of or related to the service should be limited to the amount the merchant paid for the service during the 12 months before the event giving rise to the claim, or $100 if no amount was paid, unless a different limit is required by applicable law.

## 11. Indemnity

The merchant should indemnify and hold Producer Launchpad harmless from claims arising out of:

- the merchant's content
- the merchant's licensing terms
- the merchant's unlawful or unauthorized use of the service
- the merchant's failure to provide required notices or obtain required rights

## 12. Contact

For questions about these terms or data handling, contact `newradio.sound@gmail.com`.
