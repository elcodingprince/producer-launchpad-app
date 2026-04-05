# Producer Launchpad Data Retention Policy

Draft status: internal working draft for operations and review.

## Principle

Producer Launchpad should not retain protected customer data longer than needed to operate the app, support merchants, preserve agreement evidence, and satisfy platform or legal compliance obligations.

## Launch Retention Targets

### Core order, delivery, and agreement records

- retained while the merchant actively uses Producer Launchpad
- purpose: preserve sold-license proof, maintain delivery history, and support merchant operations
- deletion trigger: uninstall, `shop/redact`, or customer redact handling where applicable

### Privacy request exports

- target retention: 90 days after the request is marked fulfilled

### Logs containing sensitive references

- target retention: 90 days unless longer retention is needed for incident investigation

### Shop uninstall and redact events

- customer and shop data should be deleted or redacted according to the Shopify compliance webhook workflow
- merchant-uploaded files stored in Producer Launchpad managed storage should be queued for deletion immediately after uninstall and permanently removed within 7 days

## Operational Requirements

- retention rules should be implemented in code or operations, not only documented
- production backups must follow a defined retention period
- local exports of protected customer data should be deleted promptly after fulfillment use

## Current Implementation Notes

- fulfilled privacy request exports are cleaned up after 90 days
- browser and agreement telemetry fields are cleaned up after 90 days
- delivery troubleshooting fields are cleaned up after 90 days
- core order, delivery, and agreement records are retained for active stores and removed or redacted through uninstall and Shopify privacy-compliance workflows
- maintain and monitor the managed-storage deletion queue used for uninstall and redact cleanup
- align any production backup retention setting with this policy
