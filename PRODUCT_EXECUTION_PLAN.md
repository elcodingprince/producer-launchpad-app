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
- Product title -> product `title` (not metafield)
- `BPM` -> `custom.bpm` (`number_integer`)
- `Key` -> `custom.key` (`single_line_text_field`)
- `Genres[]` -> `custom.genre` (`list.metaobject_reference`)
- `Producers[]` -> `custom.produced_by` (`list.metaobject_reference`)
- `Producer Alias` -> `custom.producer_alias` (`single_line_text_field`)
- `Preview file URL` -> `custom.audio_preview` (`url`)
- License files per tier -> `custom.license_files_basic|premium|unlimited` (`json`)
- Variant license link -> `custom.license_reference` (`metaobject_reference`)
- Cover art should use product media/images (not `custom.cover_art` metafield).

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
- Admin UI visibility depends on metafield pinning; unpinned definitions can appear as "No metafields pinned" even when values exist.
- Metafield pinning support is implemented in setup services (`pinRequiredMetafieldDefinitions` + `metafieldDefinitionPin`), but setup must run to apply pins.

---

## 4) Implementation Priorities

1. Initial install routing correctness (Bug 1).
2. Setup wizard action hierarchy (Bug 2).
3. My Beats data-backed list correctness (Bug 4).
4. Upload CTA/progress polish (Bug 3).

---

## 5) Progress Tracker
- Bug 1: `Pending` (investigated, not fixed)
- Bug 2: `Pending` (investigated, not fixed)
- Bug 3: `Pending` (label unchanged; loading-only state exists, no progress UI)
- Bug 4: `Pending` (known placeholder implementation)
- Technical baseline:
  - Metafield pinning capability: `Implemented` (requires setup execution)

---

## Consolidation Record
This document consolidates content from:
- `UX_BUG_FIX_PLAN.md`
- `UX_ENHANCEMENT_PLAN.md`
- `FORM-TO-METAFIELD-MAPPING.md`
- `METAFIELD-IMPLEMENTATION-PLAN.md`
- `METAFIELD-UPLOAD-COMPARISON.md`
- `METAOBJECT-REFERENCE-GUIDE.md`
