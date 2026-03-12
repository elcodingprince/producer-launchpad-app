# Product Execution Plan

## Scope and Intent
- This is the single source of truth for current UX bugs, onboarding flow fixes, upload flow expectations, and technical implementation references.
- It consolidates planning and reference content that was previously split across multiple markdown files.

## Primary Outcome
- Enable producers to complete this path with minimal friction:
  - Install app -> Complete setup -> Upload beat -> Sell licenses

---

## 1) UX Bug Backlog (Execution)

### Bug 1: Initial Install Routing
#### Problem
- Fresh install can land on a blocked dashboard (`Unable to load dashboard`) instead of setup.
#### Goal
- First-time users must be routed to setup wizard immediately.
#### Wireframe Reference
- See [INITIAL_SETUP_WIREFRAMES.md](/Users/payan/producer-launchpad-app/INITIAL_SETUP_WIREFRAMES.md) for initial-state flow options.
#### Status
- `Pending`
#### Verified Current State
- `app/routes/app._index.tsx` still renders a setup-required/dashboard-block state when setup is incomplete instead of hard-redirecting into setup wizard.
#### Acceptance Criteria
- Fresh install opens setup wizard.
- Dashboard is only reachable after required setup is complete.

### Bug 2: Setup Wizard Information Hierarchy
#### Problem
- First required action (create producer profile) appears below diagnostics/status blocks.
#### Goal
- Show primary action first; diagnostics second.
#### Status
- `Pending`
#### Verified Current State
- `app/routes/app.setup.tsx` renders `Configuration Status` and diagnostics before the producer-profile action/input.
#### Acceptance Criteria
- Producer profile action is visible above the fold.
- Setup flow is sequential and clear.

### Bug 3: Upload CTA Label + Missing Progress Feedback
#### Problem
- Primary button text (`Create Beat Product`) does not match upload intent.
- No clear progress state during upload/creation.
#### Goal
- Align CTA language with user mental model and show in-flight progress.
#### Status
- `Pending`
#### Verified Current State
- CTA still reads `Create Beat Product` in `app/routes/app.beats.new.tsx`.
- A loading state exists (`Uploading...`) but there is no explicit progress indicator.
#### TODO
- Rename CTA to `Upload`.
- Add upload/progress feedback in UI.

### Bug 4: Post-Upload Redirect to Non-Functional My Beats
#### Problem
- Success redirect goes to `My Beats`, but list can show false empty state (`No beats uploaded yet`).
#### Goal
- Ensure post-upload destination reflects actual created data.
#### Status
- `Pending`
#### Verified Current State
- `app/routes/app.beats._index.tsx` loader currently returns `beats: []` with TODO placeholder comments, so post-upload can show an empty list.
#### Acceptance Criteria
- Uploaded beat appears reliably after success.
- No misleading empty state immediately post-upload.

---

## 2) UX Enhancement Direction (MVP)

### Core UX Goals
1. Reduce onboarding confusion around storage configuration.
2. Enforce correct license-to-file mapping before publish.
3. Prevent wrong-file delivery to customers.
4. Gate uploads until setup + storage are valid.
5. Preserve advanced self-managed storage path.

### Updated User Flow (Target)
1. Install app.
2. Setup wizard (schema + producer + licenses/genres).
3. File hosting setup.
4. Upload beat (license-first flow).
5. Publish/sell.

### Upload UX Model (License-First)
1. Beat details (title, BPM, key, genre(s), producer(s)).
2. Preview + cover upload.
3. Assign files by license tier.
4. Validate all required tier assignments.
5. Create product + variants + metafields.

---

## 3) Technical Reference (Consolidated)

### Canonical Metafield Mapping
- Product title → product `title` (not metafield)
- `BPM` → `custom.bpm` (`number_integer`)
- `Key` → `custom.key` (`single_line_text_field`)
- `Genres[]` → `custom.genre` (`list.metaobject_reference`)
- `Producers[]` → `custom.produced_by` (`list.metaobject_reference`)
- `Producer Alias` → `custom.producer_alias` (`single_line_text_field`)
- `Preview file URL` → `custom.audio_preview` (`url`)
- **Cover art** → product `media` field via `images: [{ src: url }]` (✅ **NOT** `custom.cover_art` metafield)
- License files per tier → `custom.license_files_basic|premium|unlimited` (`json`)
- Variant license link → `custom.license_reference` (`metaobject_reference`)

### Metaobject Reference Rules
- Metaobject references must store GIDs, not names/handles.
- List references must be JSON-stringified arrays of GIDs.
- Producer/genre/license references should align with metafield definition type and validation.

### Product + Metafield Write Pattern
- Product creation and metafield writes must follow currently supported Shopify GraphQL patterns.
- Avoid assumptions that fields accepted in older `ProductInput` are still accepted.
- Ensure explicit error surfacing when metafield writes fail.

### Known Reliability Risks
- Embedded tunnel uploads can fail on large multipart requests (connection reset/aborted).
- ✅ **Resolved**: Admin UI visibility now automatic — metafield pinning runs during setup wizard via `pinRequiredMetafieldDefinitions()` and `metafieldDefinitionPin` mutation.
  - All required product and variant metafields are automatically pinned after definition creation.
  - No manual pinning needed in Shopify admin.

---

## 4) Implementation Priorities

1. Initial install routing correctness (Bug 1).
2. Setup wizard action hierarchy (Bug 2).
3. My Beats data-backed list correctness (Bug 4).
4. Upload CTA/progress polish (Bug 3).

---

## 5) Progress Tracker

### UX Bugs
- Bug 1: `Pending` (investigated, not fixed)
- Bug 2: `Pending` (investigated, not fixed)
- Bug 3: `Pending` (label unchanged; loading-only state exists, no progress UI)
- Bug 4: `Pending` (known placeholder implementation)

### License Delivery Automation
- Status: `Planned` — Architecture complete, ready for implementation
- Database schema: Designed
- Services: Planned (PDF, email, delivery)
- UI: Planned (templates list, edit page)
- Webhook handler: Planned

### Technical Improvements (Completed)
- ✅ **Cover art architecture**: Migrated from `custom.cover_art` metafield to product `images` array (Shopify standard)
- ✅ **Metafield upload optimization**: Product metafields now set once via `productCreate` mutation; variant metafields set separately via `setMetafields()`
- ✅ **Metafield pinning**: Automatic pinning implemented in setup wizard via `pinRequiredMetafieldDefinitions()` and `metafieldDefinitionPin` mutation
- ✅ **Upload validation**: Metafields confirmed uploading correctly (visibility issue was pinning, not upload failure)

---

---

## 6) What's Next

### Immediate Priorities (UX Bugs + Core Feature)
1. **Bug 1: Initial install routing** → Force redirect to setup on fresh install
   - Modify `app._index.tsx` to check setup status and redirect
   - Prevent dashboard rendering when setup incomplete

2. **Bug 2: Setup wizard hierarchy** → Move producer profile action above diagnostics
   - Reorder `app.setup.tsx` layout
   - Primary action first, status/diagnostics below

3. **Bug 4: My Beats data integration** → Connect product list to actual data
   - Implement `app.beats._index.tsx` loader to fetch created products
   - Remove placeholder `beats: []` response

4. **Bug 3: Upload CTA refinement** → Improve upload experience
   - Rename button from "Create Beat Product" to "Upload Beat"
   - Add progress indicator beyond loading state

5. **License Delivery Automation** → Core revenue feature
   - Implement license template management UI
   - Add PDF generation service (PDFKit)
   - Add email delivery service (Resend)
   - Create order webhook handler
   - Modify upload to set variant metafields
   - Database migrations

### License Delivery Automation (NEW FEATURE)
**Status:** `Planned` — Ready for implementation

**Overview:** Automatically generate and deliver license PDFs to customers upon purchase.

**Architecture:**
- License templates stored in DB (configured via `/app/licenses` page)
- Variant metafield `license_template_id` links variant to template
- Webhook `orders/create` triggers PDF generation + email delivery
- PDFKit for PDF generation, Resend for email delivery

**Implementation Files:**
- `app/services/license-template.server.ts` — CRUD operations
- `app/services/license-pdf.server.ts` — PDFKit PDF generation
- `app/services/license-email.server.ts` — Resend email delivery
- `app/services/license-delivery.server.ts` — Orchestration
- `app/routes/webhooks.orders-create.tsx` — Order webhook handler
- `app/routes/app.licenses._index.tsx` — Templates list UI
- `app/routes/app.licenses.$id.edit.tsx` — Edit template UI
- `app/routes/app.upload.tsx` — Modified to set variant metafields

**Database Schema:**
- `LicenseTemplate` — Stores HTML templates with placeholders
- `LicenseDelivery` — Delivery history/tracking

**User Flow:**
1. Producer configures license templates (Basic/Premium/Exclusive)
2. Upload beat → App creates variants with `license_template_id` metafield
3. Customer purchases → Automatic PDF generation + email delivery

**Cost:** Resend free tier (3,000 emails/mo), scales to $20/mo at ~900 customers

**Timeline:** 21.5 hours (3 dev days)

---

### Future Enhancements
- License file package architecture decision (3 options documented previously)
- Producer/license metaobject field completion (images, bios, terms)
- Storage configuration UX improvements
- License-first upload flow refinement

---

## Consolidation Record
This document consolidates content from:
- `UX_BUG_FIX_PLAN.md`
- `UX_ENHANCEMENT_PLAN.md`
- `FORM-TO-METAFIELD-MAPPING.md`
- `METAFIELD-IMPLEMENTATION-PLAN.md`
- `METAFIELD-UPLOAD-COMPARISON.md`
- `METAOBJECT-REFERENCE-GUIDE.md`
