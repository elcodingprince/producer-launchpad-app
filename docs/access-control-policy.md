# Producer Launchpad Access Control Policy

Draft status: internal working draft.

## Principle

Access to protected customer data should be limited to the minimum number of people and systems required to operate and support Producer Launchpad.

## Scope

This policy applies to:

- production hosting
- production database access
- storage providers
- email delivery providers
- Shopify Partner Dashboard and app configuration systems
- internal tooling that exposes customer-linked exports or delivery data

## Access Rules

- grant production access only to team members with an operational need
- use least privilege for infrastructure and provider accounts
- remove access promptly when no longer needed
- avoid sharing credentials
- require strong passwords and MFA on provider accounts where supported

## Sensitive Data Access

Access to customer-linked delivery records, agreement evidence, and privacy exports should be restricted to personnel handling:

- support
- incident response
- compliance fulfillment

## Logging

Sensitive internal actions should be logged where feasible, especially:

- privacy export creation or review
- manual delivery recovery actions
- access to production systems containing protected customer data
