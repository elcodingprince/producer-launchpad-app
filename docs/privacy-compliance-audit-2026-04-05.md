# Producer Launchpad Privacy Compliance Audit

Audit date: April 5, 2026

Scope reviewed:

- app code in `/Users/payan/producer-launchpad-app`
- public legal pages in `/Users/payan/producer-launchpad-site`
- internal privacy drafts in `/Users/payan/producer-launchpad-app/docs`

## Executive Summary

Producer Launchpad has the core Shopify privacy webhook flows implemented in code for `customers/data_request`, `customers/redact`, and `shop/redact`. The strongest compliance gap is not missing webhook support. It is documentation drift and retention drift.

The public privacy and terms pages are too generic for the current implementation. They do not disclose the actual 90-day cleanup windows that are in code, they do not name the actual providers visible in code, and they imply a cleaner retention story than the implementation really has.

The largest technical/legal risk found in this audit is that uninstall and shop-redact flows delete uploaded-file records from the database, but the reviewed code does not show deletion of the underlying Cloudflare R2 storage objects. Public-facing deletion promises should not say uploaded files are fully deleted from storage until that is implemented and verified.

## 1. Data Map Summary

| Data Type | Source | Storage | Retention | Deletion Trigger |
|-----------|--------|---------|-----------|------------------|
| Shopify app session data (`shop`, access token, user profile fields) | Shopify install/auth flow | App database `Session` | Until uninstall or `shop/redact` | `APP_UNINSTALLED` or `SHOP_REDACT` deletes session rows |
| Merchant storage settings, including merchant-managed R2 credentials | Merchant settings in app | App database `ShopStorageConfig` | Until uninstall or `shop/redact` | `APP_UNINSTALLED` or `SHOP_REDACT` |
| Merchant catalog config for stems add-on | Merchant setup in app | App database `ShopCatalogConfig` | Until uninstall or `shop/redact` | `APP_UNINSTALLED` or `SHOP_REDACT` |
| Uploaded beat file metadata (`filename`, `storageUrl`, `storageKey`, type, size) | Merchant uploads | App database `BeatFile`; actual file objects in Cloudflare R2 | DB row kept until uninstall or `shop/redact`; no verified blob-retention rule in code | DB row deleted on `APP_UNINSTALLED` or `SHOP_REDACT`; no matching R2 object deletion found |
| Draft upload/configuration records | Merchant actions in app | App database `BeatDraft` | Until merchant deletes draft, uninstall, or `shop/redact` | Manual draft delete, `APP_UNINSTALLED`, or `SHOP_REDACT` |
| License-to-file mappings | Merchant setup in app | App database `LicenseFileMapping` | Until related file/order data removed | Cascades from `BeatFile` deletion |
| Orders, order numbers, Shopify customer ID, browser IP, user agent, language | Shopify `orders/create` webhook | App database `Order` | Order record retained until customer redact, uninstall, or `shop/redact`; IP/user-agent/language cleared after 90 days | `CUSTOMERS_REDACT` nulls identifiers/telemetry for matched orders; uninstall/shop redact delete rows; 90-day maintenance clears telemetry |
| Order item details and download counts | Shopify `orders/create` webhook and later downloads | App database `OrderItem` | Until uninstall or `shop/redact` | Cascades from order deletion |
| Delivery access record (`customerEmail`, `customerName`, token, email status fields) | Shopify order webhook and Resend events | App database `DeliveryAccess` | Core record retained until customer redact, uninstall, or `shop/redact`; troubleshooting fields partly cleared after 90 days | `CUSTOMERS_REDACT` anonymizes record and rotates token; uninstall/shop redact delete rows; 90-day maintenance clears recipient/message/error/event fields |
| Executed agreement records (license snapshot, rendered HTML, PDF, proof metadata, buyer email/IP/UA) | Shopify Admin API, order webhook, in-app agreement generation | App database `ExecutedAgreement` | Agreement record retained until customer redact, uninstall, or `shop/redact`; buyer IP/user-agent cleared after 90 days | `CUSTOMERS_REDACT` rebuilds redacted artifact and nulls buyer email/IP/UA; uninstall/shop redact delete rows |
| Privacy request records and export payloads | Shopify `customers/data_request` webhook | App database `PrivacyDataRequest` | Pending requests: no aging rule in code; fulfilled requests: 90 days after fulfillment | `CUSTOMERS_REDACT` redacts matching request data; fulfilled requests can be purged manually or by maintenance; uninstall/shop redact delete rows |
| Delivery emails and email events | Outbound email via Resend, inbound Resend webhook | Resend plus app database status fields | App DB troubleshooting fields partly cleared after 90 days | 90-day maintenance clears error/recipient/message/event fields; customer redact also clears them |

## 2. Verified Data Flows

### Shopify to app

- Shopify sends `orders/create` to the app, which stores order, item, customer email/name, customer ID, download token, and checkout telemetry, then generates executed agreement records and delivery-access records.
- Shopify Admin API is queried to pull product, variant, price, line-item, license metaobject, and order client IP data used to generate executed agreements.
- Shopify compliance webhooks send `customers/data_request`, `customers/redact`, and `shop/redact`.

### App to internal storage

- Most app-owned records are stored in PostgreSQL through Prisma models.
- Uploaded beat files are stored in Cloudflare R2, either app-managed or merchant-managed, while metadata is stored in `BeatFile`.

### App to third parties

- Delivery emails are sent through Resend.
- Delivery email events return from Resend to `/webhooks/resend`.
- Hosted application URL in code points to Fly.io.

## 3. Shopify Compliance Verification

### Implemented

- Compliance webhook subscriptions are configured in [shopify.app.toml](/Users/payan/producer-launchpad-app/shopify.app.toml#L12).
- `customers/data_request`, `customers/redact`, and `shop/redact` are handled in [webhooks.tsx](/Users/payan/producer-launchpad-app/app/routes/webhooks.tsx#L15).
- Customer data request exports are created and stored in [privacyRequests.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyRequests.server.ts#L195).
- Customer redaction is implemented in [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L203).
- Shop redaction and uninstall deletion are implemented in [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L336).
- The codebase includes an internal privacy-request route in [app.privacy-requests.tsx](/Users/payan/producer-launchpad-app/app/routes/app.privacy-requests.tsx#L39), but it should be treated as support/internal tooling rather than a marketed merchant-facing feature.

### Partially implemented

- Access/portability: yes, in the sense that the app generates an export payload for matched data.
- End-to-end fulfillment: no. The app does not automatically deliver the export to the requesting customer or Shopify; fulfillment is completed operationally by Producer Launchpad support.
- Automatic retention enforcement: partial. Only some data categories have 90-day cleanup logic, and it runs when the app or webhook path is hit, not from a scheduled background job.

### Not verified in code

- Automatic deletion of underlying Cloudflare R2 file objects during uninstall or shop redact.
- A background scheduler or cron that guarantees cleanup occurs within a fixed number of hours after a retention deadline.

## 4. Gap Analysis

### Current policy claims vs. actual implementation

1. Public privacy and terms pages use generic retention language, but the code has specific 90-day cleanup windows.
   Evidence:
   - Generic public retention language in [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro#L134) and [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro#L113)
   - Actual 90-day logic in [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L17) and [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L376)

2. Internal retention draft says delivery records are kept 24 months and order telemetry 12 months, but code does not implement those windows.
   Evidence:
   - Draft claims in [data-retention-policy.md](/Users/payan/producer-launchpad-app/docs/data-retention-policy.md#L11)
   - Code only clears selected fields after 90 days in [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L390)

3. Internal privacy behavior draft says agreement artifacts may be retained up to 24 months and delivery data up to 12 months, but the reviewed code currently keeps those core records until uninstall, shop redact, or customer redact.
   Evidence:
   - Draft claims in [privacy-policy-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/privacy-policy-app-behavior-draft.md#L89)
   - No matching age-based deletion for `ExecutedAgreement`, `DeliveryAccess`, or `Order` rows in [privacyCompliance.server.ts](/Users/payan/producer-launchpad-app/app/services/privacyCompliance.server.ts#L376)

4. Public policy says customer data requests are "recorded and processed," which is directionally true but incomplete.
   Actual behavior:
   - the request is recorded
   - a JSON export is created
   - fulfillment is still manual through the app UI
   Evidence:
   - public wording in [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro#L164)
   - support-operated fulfillment workflow represented in [app.privacy-requests.tsx](/Users/payan/producer-launchpad-app/app/routes/app.privacy-requests.tsx#L88)

5. Public pages mention service providers generically, but the code reveals specific vendors that should be named.
   Evidence:
   - generic wording in [privacy.astro](/Users/payan/producer-launchpad-site/src/pages/privacy.astro#L111)
   - Cloudflare R2 in [storageConfig.server.ts](/Users/payan/producer-launchpad-app/app/services/storageConfig.server.ts#L174) and [storageUpload.server.ts](/Users/payan/producer-launchpad-app/app/services/storageUpload.server.ts#L89)
   - Resend in [email.server.ts](/Users/payan/producer-launchpad-app/app/services/email.server.ts#L68) and [webhooks.resend.tsx](/Users/payan/producer-launchpad-app/app/routes/webhooks.resend.tsx#L51)

### Missing disclosures

- Specific 90-day cleanup windows for telemetry, delivery troubleshooting fields, and fulfilled privacy requests
- Merchant-manual fulfillment step for customer data requests
- Named providers visible in code: Shopify, Cloudflare R2, Resend, Fly.io
- Event-driven nature of retention cleanup
- The fact that customer redaction preserves a redacted agreement artifact instead of deleting every agreement trace
- The fact that uninstall/shop redact delete database records but do not show verified R2 blob deletion

### Over-disclosures or unverifiable disclosures

- Public and internal terms language around encrypted backups, least-privilege staff access, and access logging are not verifiable from the code reviewed in this audit and should not be presented as implemented controls unless supported operationally.
  Evidence:
  - [terms.astro](/Users/payan/producer-launchpad-site/src/pages/terms.astro#L31)

## 5. Webhook Disclosure Guidance

### Should the compliance webhooks be mentioned?

Yes. Shopify requires transparency around user rights handling, and these webhook flows are a real part of the implementation.

### Recommended wording

Use wording that matches the code:

> When Shopify sends us a customer data request, customer deletion request, or shop deletion request, we process that request through Shopify's compliance webhook system.

For the access/export flow, do not publish "we automatically complete this within X hours" unless you implement automated fulfillment.

Recommended current phrasing:

> When Shopify sends a customer data request, we automatically create a matching export inside the app for support-operated fulfillment to the store owner.

Recommended current deletion phrasing:

> When Shopify sends a customer or shop deletion request, we automatically delete or anonymize the covered app records handled by our compliance workflow.

If you later add a guaranteed clock-based job and automated fulfillment, you can upgrade the wording to:

> When you request your data or account deletion through Shopify, we process the request automatically through secure webhooks within X hours.

That statement is not fully supported by the current code.

## 6. Recommended Privacy Policy Direction

The privacy policy should:

- start with a plain-English summary
- name actual providers
- state the real 90-day cleanup rules
- distinguish between timed cleanup and trigger-based deletion
- clearly say that customer data request fulfillment is merchant-reviewed today
- avoid promising storage-object deletion until R2 deletion is implemented

The updated implementation-aligned draft is in [privacy-policy-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/privacy-policy-app-behavior-draft.md).

## 7. Recommended Terms Updates

The terms should be updated to:

- describe the actual service as license generation, secure delivery, email delivery, and privacy request handling
- put responsibility on merchants to complete privacy request fulfillment they control
- include a termination clause tied to uninstall and platform compliance
- include a liability cap and disclaimer consistent with a hosted SaaS product that handles customer and order data
- avoid promising deletion outcomes the app does not currently enforce for storage objects

The updated implementation-aligned draft is in [terms-of-service-app-behavior-draft.md](/Users/payan/producer-launchpad-app/docs/terms-of-service-app-behavior-draft.md).

## 8. Priority Fixes Before Publishing Final Legal Pages

1. Implement and verify Cloudflare R2 object deletion for uninstall, shop redact, and any future file-delete flows.
2. Decide whether customer data request fulfillment will remain merchant-manual or become fully automated.
3. If you want hard retention promises, add a scheduled cleanup job instead of relying only on app loads and incoming webhooks.
4. Update the public site pages to match the implementation-aligned drafts after counsel review.
