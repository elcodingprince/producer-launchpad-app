# UX Bug Fix Plan

## Scope Note
- This document tracks multiple UX bugs across onboarding and post-upload flows.
- Initial setup is primarily relevant to:
  - Bug 1: Setup Wizard routing on first install
  - Bug 2: Setup Wizard information hierarchy
- Remaining bugs apply to broader product flow beyond initial install.

---

## Bug 1 - Initial Install Setup Wizard Routing

## Bug Summary
- On initial install (fresh store / cleaned metafields + metaobjects), the app loads into a blocked dashboard state:
  - `Unable to load dashboard`
  - `Failed to load dashboard`
- Expected behavior: first-time users should be routed directly into the Setup Wizard flow.

## Goal
- Ensure first-time app installs always land on Setup Wizard, not a blocked dashboard.
- Preserve existing behavior for already-configured stores.

## Current Progress
- Status: `Pending`
- Code changes: `None started yet`

## Proposed Fix Plan (TODO)
1. Audit first-load routing decisions in:
   - `app/routes/app._index.tsx`
   - `app/routes/app.setup.tsx`
   - any loader logic that checks setup/storage readiness
2. Define canonical first-install gate:
   - If setup is incomplete, redirect to `/app/setup` before rendering dashboard content.
3. Add defensive handling for missing prerequisites:
   - Missing metafield definitions
   - Missing metaobject definitions
   - Missing required seed data (licenses/genres/producers)
4. Ensure storage checks do not block setup entry:
   - Setup route should remain accessible even when storage is unconfigured.
5. Add user-facing fallback message only when setup route itself fails.
6. Validate with test scenarios:
   - Fresh install, no app data
   - Partial setup
   - Fully configured store

## Acceptance Criteria
- Fresh install opens Setup Wizard immediately.
- Dashboard is only reachable after required setup completes.
- No blocked “Unable to load dashboard” state on first install.

## Notes
- This document is a planning TODO only.
- Implementation intentionally not started yet.

---

## Additional UX Problem - Setup Wizard Information Hierarchy

### Problem
- In the current Setup Wizard, users first see a long configuration status checklist.
- The first required action (`Create your first producer profile`) appears lower on the page, after status rows.
- This creates friction and confusion during onboarding because users are shown diagnostics before the primary next action.

### UX Goal
- Make the first required action obvious and immediately actionable.
- Reduce cognitive load on first install by showing "what to do now" before "system status details."

### Proposed Solution (No Implementation Yet)
1. Reorder setup page sections for first-time stores:
   - `Primary Action Card` at top (producer profile input + CTA)
   - `Setup Progress` summary second (high-level completion state)
   - `Detailed Status` list third (metafields/metaobjects breakdown)
2. Use progressive disclosure:
   - Keep detailed missing-key lists collapsed by default under an expandable section.
3. Add clear primary CTA language:
   - Replace generic button text with task-oriented copy (e.g., `Create Producer and Continue Setup`).
4. Keep validation close to the action:
   - Show producer name field requirements inline near the input instead of buried in status copy.
5. Post-action transition:
   - After producer creation, auto-focus next required setup step and update progress in-place.

### Acceptance Criteria (UX)
- First required action is visible above the fold on initial install.
- Users can complete producer profile creation without scanning diagnostic sections.
- Setup flow feels sequential: action first, status second, details last.

### Current Progress
- Status: `Pending`
- Design/implementation: `Not started`

---

## Additional Product Flow Problem - Post Upload Redirect to Non-Functional "My Beats"

### Problem
- After successful upload, users receive a success notification and are redirected to `My Beats`.
- `My Beats` currently behaves like a placeholder frontend state and does not reliably display uploaded products.
- Result: users see `No beats uploaded yet` even after successful upload, which breaks trust and causes confusion.

### Product Goal
- Ensure the post-upload destination reflects real data and confirms the uploaded beat exists.
- Remove false-empty states immediately after a successful creation flow.

### Proposed Solution (No Implementation Yet)
1. Define `My Beats` as a real source-of-truth view:
   - Query Shopify products created by the app (or app DB index mapped to Shopify product IDs).
2. Align success redirect behavior:
   - Keep redirect to `My Beats` only if it is data-backed and shows the new beat.
   - If list indexing is eventually consistent, show optimistic entry + loading state.
3. Add resilient empty-state logic:
   - Empty state should only render when confirmed no beats exist.
   - Immediately after successful upload, show contextual success state with link to the created product.
4. Add minimal observability:
   - Log product fetch counts and query filters for debugging mismatches.
5. Validate across scenarios:
   - First uploaded beat
   - Multiple beats
   - Deleted/unpublished product edge cases

### Acceptance Criteria
- A successful upload is visible in `My Beats` without misleading empty-state messaging.
- Users can navigate from success state to the exact created Shopify product.
- `My Beats` list and upload flow remain consistent across refreshes.

### Current Progress
- Status: `Pending`
- Design/implementation: `Not started`
