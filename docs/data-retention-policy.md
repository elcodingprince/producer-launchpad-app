# Producer Launchpad Data Retention Policy

Draft status: internal working draft for operations and review.

## Principle

Producer Launchpad should not retain protected customer data longer than needed to operate the app, support merchants, preserve agreement evidence, and satisfy platform or legal compliance obligations.

## Proposed Retention Targets

### Delivery access and delivery status records

- target retention: 24 months after the related order, unless a shorter or longer period is required for support or dispute handling

### Executed agreements and agreement evidence

- target retention: 24 months after purchase, unless a merchant support, legal, or dispute matter requires continued retention

### Order-linked audit metadata

- target retention: 12 months after the related order unless required for active support or incident review

### Privacy request exports

- target retention: 90 days after the request is marked fulfilled

### Logs containing sensitive references

- target retention: 90 days unless longer retention is needed for incident investigation

### Shop uninstall and redact events

- customer and shop data should be deleted or redacted according to the Shopify compliance webhook workflow

## Operational Requirements

- retention rules should be implemented in code or operations, not only documented
- production backups must follow a defined retention period
- local exports of protected customer data should be deleted promptly after fulfillment use

## Next Implementation Steps

- add scheduled cleanup for privacy request exports
- define cleanup jobs for aged delivery and agreement data where appropriate
- align any production backup retention setting with this policy
