# License PDF and Metaobject Follow-Up

This is intentionally deferred until after the delivery flow is stable.

## Current Scope Boundary

Right now, the focus is:

- identifying the purchased beat correctly
- identifying the purchased license package correctly
- delivering the correct files from Prisma without mixing packages across beats

This document is for the next phase, after that flow is stable.

## Work On Next

### 1. Define the canonical source for legal/license content

Decide which fields in the `beat_license` metaobject are:

- merchant-editable storefront/display fields
- legal contract fields used in generated PDFs
- optional marketing/helper fields that should not affect the contract

### 2. Restructure the `beat_license` metaobject definition

Review the current fields and decide which should remain:

- `license_name`
- `display_name`
- `stream_limit`
- `copy_limit`
- `term_years`
- `includes_stems`
- `term_1` ... `term_6`

Decide whether to:

- keep explicit clause fields
- move to a richer structured format
- version the legal template separately from display metadata

### 3. Decide how PDFs should be generated

Choose between:

- generating on demand from live Shopify metaobject data
- generating on demand from a purchase-time Prisma snapshot
- pre-generating and storing the PDF at purchase time

Current recommendation:

- use purchase-time snapshot data in Prisma for legal accuracy
- generate the PDF from that snapshot

### 4. Snapshot contract data at purchase time

If we want customers to receive the exact terms they bought, the order flow should store:

- license name snapshot
- limits snapshot
- stems inclusion snapshot
- legal clause snapshot
- producer/store identity snapshot
- agreement/template version

### 5. Update the PDF route

Replace placeholder logic in `app/routes/api.pdf.$token.$itemId.tsx` with:

- Prisma-backed purchase snapshot lookup
- real contract data rendering
- stable file naming and optional regeneration rules

### 6. Review merchant customization UX

Decide how merchants should edit:

- license naming
- display labels
- contract clauses
- producer/legal identity shown in the PDF

This should be designed after delivery and entitlement resolution are stable.
