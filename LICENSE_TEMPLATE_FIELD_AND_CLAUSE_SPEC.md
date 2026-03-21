# License Template Field And Clause Spec

## Purpose

This document defines how the Producer Launchpad license template edit form should control agreement language.

The core rule is:

- merchants should configure structured license options
- the app should assemble agreement language from controlled clause blocks
- merchants should not be directly rewriting the full legal agreement body for standard templates

This keeps the output predictable, safer to maintain, and easier to version.

## Rendering Model

Each executed agreement should be assembled from:

1. a base legal template family
2. clause blocks selected from structured form options
3. shop-level licensor data
4. order-level transaction facts
5. optional merchant addendum terms

The renderer should not attempt to "rewrite" the contract from scratch based on merchant inputs.

## Core Rule

The license template edit form should control:

- structured variables
- approved clause variants
- storefront copy
- limited merchant addendum terms

The full agreement body should remain app-controlled and versioned.

## Form Field To Template Mapping

### `license_name`

- Type: text
- Purpose: merchant-facing display name
- Affects:
  - storefront display
  - PDF title and summary block
- Does not affect:
  - legal rights model

### `legal_template_family`

- Type: select
- Values:
  - `basic`
  - `premium`
  - `unlimited`
- Affects:
  - base legal template selection
  - grant of rights language
  - song-count language
  - cap logic language
  - term framing
  - sync and Content ID baseline posture

### `stream_limit`

- Type: number, with `0` meaning unlimited
- Affects:
  - usage limits clause
  - commercial use summary language
- Logic:
  - if `0`, render unlimited stream language
  - otherwise render the fixed cap

### `copy_limit`

- Type: number, with `0` meaning unlimited
- Affects:
  - usage limits clause
- Logic:
  - if `0`, render unlimited copies or sales language
  - otherwise render the fixed cap

### `video_view_limit`

- Type: number, with `0` meaning unlimited
- Affects:
  - music video and audiovisual usage clause

### `term_years`

- Type: number, with `0` meaning perpetual
- Affects:
  - term clause
- Logic:
  - if `0`, render perpetual term language
  - otherwise render fixed-term language

### `stems_policy`

- Type: select
- Values:
  - `not_available`
  - `available_as_addon`
  - `included_by_default`
- Affects:
  - delivery clause
  - stems rights clause
  - restrictions clause
  - storefront display and package summaries
- Clause variant selected:
  - `stems_none`
  - `stems_addon`
  - `stems_included`

### `content_id_policy`

- Type: select
- Values:
  - `not_allowed`
  - `allowed_for_new_song_only`
- Affects:
  - Content ID clause
- Clause variant selected:
  - `content_id_none`
  - `content_id_song_only`

### `sync_policy`

- Type: select
- Values:
  - `not_included`
  - `standard_online_video_only`
  - `limited_sync_with_approval`
- Affects:
  - sync and audiovisual rights clause
- Clause variant selected:
  - `sync_none`
  - `sync_standard`
  - `sync_limited_approval`

### `publishing_split_mode`

- Type: select
- Values:
  - `fixed_split`
  - `custom_split_summary`
  - `left_to_parties`
- Affects:
  - publishing and PRO clause
- Clause variant selected:
  - `publishing_fixed`
  - `publishing_custom`
  - `publishing_open`

### `publishing_split_summary`

- Type: text
- Used with:
  - `publishing_split_mode`
- Affects:
  - publishing clause body when the split is rendered as freeform structured summary text

### `credit_requirement`

- Type: select
- Values:
  - `required`
  - `commercially_reasonable`
  - `not_required`
- Affects:
  - credit clause
- Clause variant selected:
  - `credit_required`
  - `credit_reasonable`
  - `credit_none`

### `file_formats`

- Type: structured multiselect
- Example values:
  - `MP3`
  - `WAV`
  - `STEMS`
- Affects:
  - delivery summary text
  - package description
- Important:
  - this is not enough by itself to define stems rights
  - stems rights should still be controlled by `stems_policy`

### `features_short`

- Type: multiline text
- Affects:
  - storefront only
- Does not affect:
  - legal agreement body

### `storefront_summary`

- Type: multiline text
- Affects:
  - storefront only
- Does not affect:
  - legal agreement body

### `custom_term_1` through `custom_term_6`

- Type: multiline text
- Affects:
  - addendum or custom terms section near the end of the agreement
- Rendering rule:
  - include only non-empty terms
- Guardrail:
  - these are additions, not replacements for core legal clauses

## Shop-Level Licensor Fields

These values should come from the shop's default `licensor` record, not from the per-license edit form.

### `licensor_display`

- Affects:
  - party identification
  - signature block
  - footer

### `licensor_email`

- Affects:
  - party metadata block
  - notice clause

### `governing_law_region`

- Affects:
  - governing law clause

### `dispute_forum`

- Affects:
  - dispute forum clause

### `notice_email`

- Affects:
  - notices clause

### `signature_image`

- Affects:
  - optional signature block rendering
- Recommended behavior:
  - if present, show image
  - if absent, render typed electronic signature language

## Order-Level Fields

These should be captured per transaction and applied only at agreement generation time.

### `stems_included_in_order`

- Affects:
  - final stems wording in the executed agreement
- Important:
  - this is an order-level fact
  - it should not be stored only as a template-level value

### `purchase_date`

- Affects:
  - effective date
  - signature block
  - footer

### `order_id`

- Affects:
  - metadata block
  - footer
  - execution snapshot and audit record

### `buyer_ip`

- Affects:
  - audit footer or execution metadata

### `user_agent`

- Affects:
  - audit footer or execution metadata

## Clause Block Architecture

The renderer should compose the final agreement from clause blocks like:

- `grant_clause`
- `usage_clause`
- `term_clause`
- `delivery_clause`
- `stems_clause`
- `content_id_clause`
- `sync_clause`
- `publishing_clause`
- `credit_clause`
- `custom_terms_section`
- `licensor_signature_block`

## Base Template Families

The app should support three base legal families:

- `basic`
- `premium`
- `unlimited`

### Why Keep Three Families

The Unlimited offer changes the legal structure in meaningful ways:

- one New Song vs one or more New Songs
- capped vs uncapped usage model
- perpetual or expanded-term language
- broader exploitation scope

That is enough legal divergence to justify separate base families even if the app uses a shared renderer.

## Recommended Rendering Flow

1. Load the selected `beat_license`.
2. Read `legal_template_family`.
3. Load the matching base legal template.
4. Load the default shop `licensor`.
5. Load order-level facts.
6. Resolve clause variants from structured field values.
7. Inject placeholders into the final agreement.
8. Save the fully rendered agreement snapshot and template version in the app database.

## What Should Never Be Raw Merchant Free-Edit

These areas should remain controlled by the app's approved legal templates:

- grant of rights
- ownership reservation
- resale and sublicensing restrictions
- liability and limitation language
- electronic acceptance language
- platform non-party language

## What Can Be Merchant-Customized Safely

These are appropriate merchant-controlled areas:

- license display name
- usage caps
- term length
- stems offer mode
- Content ID setting
- sync setting
- publishing summary
- storefront bullets
- optional addendum terms

## Recommended Data Rule For Stems

Treat stems as a separate rights module layered on top of the core license family.

### Core License Family Controls

- one song vs multiple songs
- usage caps
- term
- sync and commercial scope

### Stems Policy Controls

- whether stems are unavailable
- whether stems may be purchased as an add-on
- whether stems are included by default
- which stems clause variant is rendered

### Order-Level Stems Fact Controls

- whether stems were actually included in that specific transaction

This avoids multiplying templates like:

- basic-with-stems
- basic-without-stems
- premium-with-stems
- premium-without-stems

Instead, the app should keep:

- 3 base legal families
- 1 stems module with 3 modes

## Working Principle

Marketing names and storefront copy should be fully customizable by the merchant.

Legal rights should be determined by:

- the internal legal template family
- structured legal settings
- controlled clause variants
- order-level transaction facts

This lets merchants market flexibly without letting freeform copy accidentally define the legal scope of the agreement.
