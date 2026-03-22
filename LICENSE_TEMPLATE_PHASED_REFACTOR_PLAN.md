# License Template Phased Refactor Plan

This plan replaces the current "fully editable live template" model with a safer
three-layer split:

- `Live template`
  - reusable `beat_license` metaobject
  - powers storefront offers and future purchases
  - only safe fields update live
- `Beat offer configuration`
  - variant-level settings for a specific beat offer
  - controls whether that beat currently sells an optional stems add-on
  - can change later without reshaping the shared template
- `Executed agreement`
  - frozen purchase-time record
  - powers historical agreement downloads, audit proof, and support lookups
  - never changes after purchase

This is the correct launch model because:

- merchants still get reusable live templates
- active beats do not retroactively break from template edits
- lower tiers can offer stems on some beats and not others
- future purchases use the latest live template plus current beat-level offer settings
- past purchases stay tied to the exact terms and offer state used at purchase time

## Core Rules

1. `offer_archetype` is immutable once a template exists.
2. The template defines legal family and base included files.
3. The beat/product decides whether optional stems are currently offered.
4. Frozen purchases store both:
   - the resolved live template used at purchase time
   - the beat-level stems configuration and order outcome used at purchase time

## Launch Archetypes

Launch archetypes stay intentionally narrow:

- `basic`
  - agreement family: `basic`
  - base files: `MP3`
  - stems included by default: `no`
  - stems add-on capable: `yes`
- `premium`
  - agreement family: `premium`
  - base files: `MP3, WAV`
  - stems included by default: `no`
  - stems add-on capable: `yes`
- `unlimited`
  - agreement family: `unlimited`
  - base files: `MP3, WAV`, with optional bundled stems
  - stems included by default: `template-controlled`
  - stems add-on capable: `yes`, when stems are not bundled in the base package

Important launch simplification:

- `Basic` and `Premium` can optionally sell a stems add-on per beat.
- `Unlimited` can either bundle stems in the base package or sell stems as an
  optional add-on, controlled on the live template.
- If you later want combinations like `Premium with stems included`, add a new
  locked archetype instead of reopening live template editing.

## Data Model

### Live template: `beat_license`

The template remains the shared source of truth for:

- `offer_archetype`
- `license_name`
- preset usage limits
- storefront summary
- feature bullets
- allowed addendum terms
- other safe agreement settings

The template no longer acts as the live switch for whether a published beat
currently offers an optional stems add-on.

### Beat offer configuration: variant-level metafield

Add a variant metafield:

- namespace: `custom`
- key: `stems_addon_enabled`
- type: `boolean`

This metafield stores whether that specific published offer currently sells the
stems add-on.

Why this shape is the best fit:

- each upload-row offer already maps to a Shopify variant
- checkout, delivery, and agreement generation already key off the variant
- it avoids a confusing product-level list in Shopify Admin
- it keeps stems state tied to the exact offer the buyer purchased

Interpretation rules:

- if archetype is `basic` or `premium` and `stems_addon_enabled = true`, that
  offer currently sells the stems add-on
- if archetype is `basic` or `premium` and `stems_addon_enabled = false`, that
  offer does not currently sell the stems add-on
- if archetype is `unlimited`, the live template decides whether stems are
  bundled in the base package or sold as an optional add-on
- the variant-level boolean remains the source of truth only for `basic` and
  `premium`

### Executed agreement

Frozen purchase records must store:

- the resolved live template used at purchase time
- the beat-level stems configuration used at purchase time
- whether stems were actually included in that order
- buyer/order audit data
- rendered HTML and PDF snapshots

## Phase 1: Lock Template Archetype

Goal:

- stop allowing one template to be reshaped into a different legal or base
  delivery type

Implementation:

- add immutable `offer_archetype`
- launch archetypes:
  - `basic`
  - `premium`
  - `unlimited`
- derive these fields from archetype instead of exposing them as
  merchant-editable:
  - `legal_template_family`
  - `file_formats`
- remove stems add-on availability from the live template edit surface
- keep `license_id` only as a compatibility mirror for now
- update app readers so they prefer archetype-derived values over stale editable
  values

Result:

- templates stay reusable
- file package requirements stop drifting from random edits
- template edits no longer control whether a published beat currently sells a
  lower-tier stems add-on

Test guide:

1. Create a new template and confirm `Template type` is selectable.
2. Save the template and reopen it.
3. Confirm `Template type`, `File formats`, and `Agreement family` are no
   longer editable.
4. Confirm stems add-on availability is no longer presented as a live template
   field for `Basic` and `Premium`.
5. Edit only the template name and confirm the preview updates.

## Phase 2: Add Beat-Level Stems Offer Configuration

Goal:

- let merchants decide, per beat and per eligible offer, whether optional stems
  are currently sold

Implementation:

- seed a new variant metafield definition during app setup:
  - `custom.stems_addon_enabled`
  - type `boolean`
- include this definition in onboarding/setup seeding automatically
- do not ask merchants an onboarding question for this; just seed the
  capability
- update beat creation so each license variant writes this metafield when the
  beat is created
- update beat readers so readiness, storefront data, and fulfillment all use
  this variant-level setting

Upload page UX:

- when uploading a beat, show a simple stems control for each selected license:
  - `Basic` / `Premium`
    - checkbox or toggle: `Offer stems add-on for this beat`
  - `Unlimited`
    - read-only note derived from the live template:
      - `Includes stems by default`
      - or `Sells stems as optional add-on`
- default `Basic` and `Premium` stems add-on toggles to `off` for launch
- if the merchant enables stems for at least one eligible offer, require the
  shared stems ZIP before publish
- if the selected `Unlimited` template bundles stems in the base package,
  require the shared stems ZIP before publish

Why this is better than keeping the switch on the template:

- merchants can change business strategy beat by beat
- shared templates stay clean and predictable
- live template edits no longer retroactively change storefront availability for
  every beat using that template
- `Unlimited` can still support a bundled or add-on stems model without
  creating a separate archetype

Test guide:

1. Run setup on a store and confirm `custom.stems_addon_enabled` is created on
   variants.
2. Upload a beat with `Basic`, `Premium`, and `Unlimited`.
3. Confirm `Basic` and `Premium` show stems add-on toggles and `Unlimited`
   shows stems included.
4. Leave both toggles off and confirm the beat can publish without a stems ZIP
   if `Unlimited` is not selected.
5. Turn one toggle on and confirm publishing requires a shared stems ZIP.
6. Confirm the saved Shopify variants contain `custom.stems_addon_enabled`
   values that match the upload toggles.
7. Edit an `Unlimited` template so stems are sold as an add-on and confirm live
   storefront products immediately reflect the change.
8. Place orders with and without stems on an older uploaded beat and confirm
   delivery matches the resolved order entitlement rather than stale upload-time
   mappings.

## Phase 3: Replace Freeform Limits With Presets

Goal:

- remove messy free-typed operational settings

Implementation:

- replace typed inputs for:
  - `stream_limit`
  - `copy_limit`
  - `video_view_limit`
  - `term_years`
- use curated preset selects per archetype
- keep live-editable:
  - `license_name`
  - selected cap presets
  - `storefront_summary`
  - `features_short`
  - limited addendum terms
- move advanced legal settings into a secondary or collapsed section

Example preset direction:

- `basic` streams:
  - `10,000`
  - `25,000`
  - `50,000`
  - `100,000`
  - `250,000`

Test guide:

1. Create a template for each archetype.
2. Confirm limits can only be chosen from presets.
3. Confirm the agreement preview and offer summary reflect the selected preset
   values.
4. Confirm no preset edit can change base files or live stems add-on
   availability.

## Phase 4: Normalize Existing Templates And Beats

Goal:

- migrate current data into the locked-template plus beat-level stems model

Implementation:

- normalize every existing template into the nearest valid archetype
- preserve:
  - customer-facing name
  - safe editable fields
  - storefront summary
  - feature bullets
  - addendum terms
- remove any inconsistent live template stems settings and map them into:
  - archetype defaults
  - per-variant `stems_addon_enabled` values where appropriate
- flag any custom template that cannot be cleanly normalized for one-time review

Expected result:

- live templates remain reusable
- fulfillment-impacting fields stop drifting
- active beat readiness is no longer retroactively invalidated by template edits

Test guide:

1. Review starter templates after migration and confirm their archetype is
   correct.
2. Review any custom templates and confirm name/copy were preserved.
3. Review a few existing beats and confirm their stems offer state was migrated
   correctly.
4. Open Beats and confirm previously ready offers still show as ready unless
   they were already genuinely incomplete.

## Phase 5: Add Executed Agreement Snapshots

Goal:

- freeze the actual agreement record at purchase time

Implementation:

- add `ExecutedAgreement` model
- create one record per purchased `OrderItem`
- store:
  - `orderItemId`
  - template metaobject ID and handle
  - `offerArchetype`
  - `templateVersion`
  - resolved license JSON
  - beat-level stems offer state at purchase time
  - `stemsIncludedInOrder`
  - licensor snapshot JSON
  - rendered agreement HTML
  - HTML hash
  - PDF storage URL
  - PDF hash
  - buyer email
  - buyer IP
  - user agent
  - purchase timestamp
- generate and store the executed agreement at order time, not only on later
  download

Important:

- this phase is the real "freeze"
- `license_id` is not the freeze mechanism
- the immutable executed agreement record is the freeze mechanism

Test guide:

1. Place a test order.
2. Confirm one `ExecutedAgreement` record is created for each purchased order
   item.
3. Confirm the stored record includes:
   - resolved license settings
   - beat-level stems offer state
   - `stemsIncludedInOrder`
   - licensor snapshot
4. Confirm the PDF is stored or a retry status is recorded if generation fails.

## Phase 6: Serve Historical Agreements From Snapshots

Goal:

- ensure older purchases never change when live templates or beat-level offer
  settings change

Implementation:

- update the agreement download/PDF route to use `ExecutedAgreement` first
- only fall back to live rendering for legacy pre-snapshot orders
- serve the stored PDF to buyers
- keep the HTML/JSON snapshot for audit and support use

Expected result:

- future purchases use the current live template plus current beat-level offer
  settings at checkout time
- past purchases use the stored executed agreement from their purchase date

Test guide:

1. Place an order and download the agreement.
2. Edit the live template name or caps.
3. Change the beat-level stems add-on toggle for future sales.
4. Download the older order's agreement again.
5. Confirm it is unchanged.
6. Place a new order and confirm the new agreement reflects the updated live
   state.

## Phase 7: Capture Buyer-Accepted Version Metadata

Goal:

- strengthen proof of exactly what the buyer accepted

Implementation:

- pass agreement acceptance metadata from storefront/cart:
  - `accepted_template_version`
  - `accepted_template_hash` or immutable version token
  - `accepted_at`
- persist those values onto the executed agreement record
- include the resolved beat-level stems offer state tied to the selected
  license line
- use them in agreement and audit proof

This phase is especially valuable for:

- support disputes
- proving what version was shown to the buyer
- preserving a defensible transaction record

Test guide:

1. Add a beat to cart from the storefront.
2. Confirm accepted version metadata is attached to the license line.
3. Complete checkout.
4. Confirm the executed agreement record stores the same version/hash and the
   stems offer state that applied at checkout.

## Phase 8: Remove Legacy Identifier Dependence

Goal:

- fully transition away from merchant-managed `license_id`

Implementation:

- keep using:
  - `license_reference` for variant -> template linkage
  - `offer_archetype` for template type
  - variant-level `stems_addon_enabled` for live stems offers
  - variant/product/order IDs for fulfillment and delivery
- remove remaining runtime dependence on merchant-editable `license_id`
- keep compatibility mirrors only where still strictly necessary

Test guide:

1. Search the app and theme for remaining runtime `license_id` dependencies.
2. Confirm upload, storefront, agreement generation, and delivery still work
   without exposing `license_id` in the editor.

## Implementation Order

Recommended order:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8

## Notes For Launch

- This should be implemented before real customer data depends on the old
  behavior.
- Historical orders created before the freeze model can be treated as legacy
  reconstructed records if needed.
- The app should always prefer:
  - live templates for future storefront sales
  - beat-level variant configuration for current offer availability
  - executed snapshots for historical orders
