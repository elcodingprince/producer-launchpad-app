# License Template And Licensor Implementation Plan

## Goal

Ship launch-ready, English-language starter templates for non-exclusive beat licenses while keeping Producer Launchpad low-friction, operationally clean, and positioned as a technical platform rather than a legal service.

This plan is designed to let a merchant install the app, complete onboarding in a few clicks, review the starter templates with a quick scan, and begin uploading music immediately.

## Product Positioning

- Producer Launchpad provides professional starter templates for non-exclusive beat licenses.
- Producer Launchpad is not a law firm, does not provide legal advice, and is not a party to the license agreement.
- The producer or merchant is the contracting party shown as the Licensor.
- Templates are designed for English-language use and broad international accessibility, but may require producer customization and local legal review depending on jurisdiction.

## Launch Scope

### In Scope

- English-language starter templates
- Non-exclusive beat licenses only
- Producer review and acceptance of starter templates
- Producer-configurable commercial terms
- Shop-level legal identity for the Licensor
- Executed agreement generation with audit trail

### Out Of Scope For Launch

- Exclusive licenses
- Work-for-hire agreements
- Custom sync agreements
- Sample-clearance workflows
- Minor-specific contracting flows
- Label-negotiated custom terms
- Jurisdiction-specific legal packs
- Multi-language legal templates

## Friction-Light Licensor Setup

Licensor setup should happen during onboarding, but it should not feel like a separate legal workflow.

### Recommended Onboarding Approach

Keep the existing producer setup step and add a small legal identity fieldset to the same step.

### Required Fields At Onboarding

- `Producer name`
- `Licensor / business name`
- `Notice email`

### Friction-Light Defaults

- Prefill `Licensor / business name` from `Producer name`
- Prefill `Notice email` from the Shopify session or account email when available
- Auto-create the default Licensor in the same setup run that seeds producers, genres, and starter license templates

### Fields Deferred To Settings

These should not block onboarding:

- business entity type
- DBA / trade name
- signature image
- governing law
- dispute forum
- notice mailing address
- advanced publishing / Content ID / sync preferences

## Why Licensor Should Be Separate From Producer

- `Producer` is the creative identity attached to beats and storefront attribution.
- `Licensor` is the legal contracting party named in the agreement.
- Some merchants will want both values to match.
- Some merchants will use a company, DBA, or manager-operated entity as the Licensor while keeping a stage name as the Producer.

This separation is important for scale and avoids overloading the producer model with legal identity data.

## Signature Handling

### Launch Recommendation

- Do not require a signature upload during onboarding.
- Do not use a signature PDF.
- Treat any signature image as optional presentation, not as the legal basis for enforceability.

### Agreement Behavior

- Always render typed Licensor identity in the agreement
- If a signature image exists, display it as a visual signature
- If no signature image exists, render a line such as `Signed electronically by [Licensor Name]`

### Legal Backbone

The enforceability model should rely on:

- clear party identification
- purchase or acceptance flow
- template version tracking
- order and transaction metadata
- audit trail capture

## Storage Strategy

Use a split between merchant-owned config in Shopify and app-owned historical evidence in the app database.

### Store In Shopify Metaobjects

These are merchant-editable business records and should be the source of truth inside the shop:

- `producer`
- `licensor`
- `beat_license`

### Store In App Database

These are app-owned operational or historical records and should remain outside merchant-editable Shopify content:

- starter template acceptance records
- accepted starter template version
- generated agreement snapshots
- execution audit trail
- PDF generation metadata
- delivery and download records

## Full Agreement Text Vs Structured License Data

The full legal agreement body should not live in Shopify metaobjects.

### Store Full Agreement Text In The App

Keep the full agreement text versioned inside the app so the platform controls:

- clause structure
- template versioning
- drafting updates
- execution snapshots
- audit consistency

### Store Structured Merchant-Customizable Values In Shopify

Keep merchant-editable structured values in Shopify metaobjects so they can control:

- commercial limits
- storefront summaries
- delivery packaging
- optional add-on behavior
- a limited number of custom merchant terms

This keeps the legal source stable while allowing business customization.

## Metaobject Model

### `producer`

Keep as the creative identity used for:

- storefront attribution
- beat metadata
- producer display and branding

### `licensor`

Add a new Shopify metaobject definition for shop-level legal identity.

#### Launch Fields

- `legal_name`
- `display_name`
- `email`
- `is_default`

#### Later Settings Fields

- `business_entity_type`
- `dba_name`
- `signature_image`
- `signature_label`
- `governing_law_region`
- `dispute_forum`
- `notice_address`

### `beat_license`

Expand the existing `beat_license` metaobject so it cleanly separates storefront copy from legal and commercial rules.

#### Storefront / Display Fields

- `license_name`
- `legal_template_family`
- `features_short`
- `storefront_summary`
- `file_formats`
- `storefront_badge` or equivalent future display field

#### Legal / Commercial Rule Fields

- `stream_limit`
- `copy_limit`
- `video_view_limit`
- `term_years`
- `stems_policy`
- `content_id_policy`
- `sync_policy`
- `credit_requirement`
- `publishing_split_mode`
- `publishing_split_summary`
- `custom_term_1`
- `custom_term_2`
- `custom_term_3`
- `custom_term_4`
- `custom_term_5`
- `custom_term_6`

## UX Placement

### Onboarding

Use onboarding to collect the minimum information needed to seed the store quickly:

- Producer name
- Licensor / business name
- Notice email

The merchant should not have to think about legal configuration in depth before uploading beats.

### Settings

Add a `Legal identity` section in Settings for later refinement:

- business entity type
- DBA
- optional signature image
- notice details
- governing law
- dispute forum

### Licenses Page

Keep the Licenses page focused on:

- starter template review
- template previews
- storefront copy
- usage limits
- delivery formats
- commercial and legal rule configuration per template

The Licenses page can reference the default Licensor, but it should not be the main place where legal identity is managed.

### Template Preview Modes

The Licenses page should support two preview modes:

- `Preview starter template`
- `Preview with my settings`

#### Preview Starter Template

This mode shows the merchant the underlying starter agreement for the selected legal family and clause choices.

Recommended behavior:

- render the selected legal family
- apply the currently selected clause variants
- keep order-specific placeholders visible or use neutral labels
- make it easy for the merchant to understand the legal structure before saving

This mode is for reviewing the starter language itself.

#### Preview With My Settings

This mode shows the merchant how the agreement looks after applying their current settings.

Recommended behavior:

- inject the merchant's license name
- inject the merchant's licensor data
- inject limits, term, stems policy, and clause selections
- use sample buyer and order values for unresolved transaction data

Example sample values:

- `Sample Artist`
- `sample@example.com`
- `ORDER-12345`
- `January 1, 2026`

This mode is for reviewing the near-final customer-facing agreement before any actual purchase occurs.

### Recommended UI Copy

For the preview actions:

- `Preview starter template`
- `Preview with my settings`

For helper text near the preview controls:

- `Starter preview shows the legal base for this offer family.`
- `Resolved preview shows how the agreement will look with your current settings and sample buyer data.`

For helper text near custom license names:

- `This name is customer-facing and can be used for storefront marketing. The legal rights still follow the selected template family.`

For helper text near stems settings:

- `Choose whether stems are unavailable, offered as an add-on, or included by default. The final agreement will also reflect whether stems were actually included in the order.`

## Agreement Architecture

### Keep In App

Versioned agreement templates should live in the app as the legal source of truth.

Each agreement should combine:

- app-owned legal boilerplate
- legal template family
- clause variants selected from structured fields
- licensor identity data
- order data
- buyer data
- audit metadata

### Remove Or Generalize From Existing Masters

The Beat Business master agreements should be used as the drafting base, but launch-ready app templates should remove or generalize:

- hardcoded Arizona governing law and venue
- U.S.-only electronic signature framing
- one-producer-specific operational language
- hardcoded publishing assumptions that do not fit all merchants

## Guardrails And Liability Position

### Merchant Guardrail

Before editing or activating starter templates, the merchant should acknowledge that:

- the templates are starter forms
- Producer Launchpad is not a law firm
- Producer Launchpad does not provide legal advice
- the merchant is responsible for confirming the template fits their business and local law
- the merchant is responsible for ensuring they own or control the rights they license

### Platform Terms

Producer Launchpad Terms of Service should also cover:

- no legal advice
- no promise of jurisdiction-wide enforceability
- merchant responsibility for rights ownership and compliance
- indemnity from merchants for claims tied to their content or licensing
- liability cap for the platform

## Implementation Order

1. Extend onboarding to collect `Licensor / business name` prefilled from producer name.
2. Add a Shopify `licensor` metaobject definition in `metafieldSetup.ts`.
3. Auto-create one default licensor during setup.
4. Add a `Legal identity` section to `app.settings.tsx`.
5. Keep full agreement text versioned in the app, not in metaobjects.
6. Expand `beat_license` fields to cleanly separate storefront copy from legal/commercial terms.
7. Add raw starter and resolved preview modes on the Licenses page.
8. Store executed agreement snapshots and audit data in the app DB.

## Recommended Build Sequence

### Phase 1: Foundation

- create `licensor` metaobject definition
- update setup flow to seed a default licensor
- add low-friction onboarding fields
- add settings UI for legal identity

### Phase 2: Template System

- migrate from placeholder PDF summary to full agreement templates
- version agreement templates inside the app
- wire agreement generation to merge licensor, license, order, and buyer data

### Phase 3: Launch Guardrails

- strengthen starter-template acceptance copy
- update marketing and in-app wording away from "valid worldwide"
- add platform ToS and legal disclaimers

### Phase 4: Historical Evidence

- save executed agreement snapshot at time of generation
- save template version hash
- save order, customer, and acceptance audit data

## Launch Principle

The launch version should optimize for speed and clarity:

- minimal onboarding friction
- strong enough starter templates
- clear producer responsibility
- clean separation of merchant config and app-owned legal evidence

The merchant should be able to install the app, enter a producer name, confirm or edit a Licensor / business name, review the starter templates with a quick scan, and start uploading music within a few clicks.
