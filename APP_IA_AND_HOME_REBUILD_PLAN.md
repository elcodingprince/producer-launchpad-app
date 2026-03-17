# Producer Launchpad App IA and Home Rebuild Plan

## Purpose

This is the implementation roadmap for fixing Producer Launchpad's app structure, homepage, onboarding flow, and settings access.

It exists so we can implement the UX architecture deliberately instead of continuing to patch isolated pages.

This plan is specifically about:

- app navigation and page ownership
- onboarding migration into Home
- restoring permanent merchant access to configuration
- giving Licenses a clear role in the product
- keeping Deliveries focused on post-purchase monitoring

This plan complements, but does not replace, [LAUNCH_PLAN.md](/Users/payan/producer-launchpad-app/LAUNCH_PLAN.md).

---

## Locked Decisions

These decisions are now treated as product constraints unless a stronger reason appears.

- `Beats` owns catalog creation and management.
- `Licenses` owns reusable commercial-use templates.
- `Deliveries` owns post-purchase operational monitoring.
- `Settings` must exist as an accessible permanent configuration surface.
- `Home` at `/app` must become:
  - `Get started` when setup is incomplete
  - `Overview` when setup is complete
- The app name already functions as "home" in app nav, so we should not create a redundant visible `Home` nav item.
- Metafield/metaobject seeding should stay hidden behind merchant-friendly health and repair UI.
- Delivery status should stay out of Licenses except for subtle automation reassurance.

---

## App Structure Target

### Primary nav

- `Beats`
- `Deliveries`
- `Licenses`
- `Settings`

### Route purposes

- `/app`
  - `Get started` for incomplete stores
  - `Overview` for ready stores
- `/app/beats`
  - catalog browsing and upload entry point
- `/app/licenses`
  - reusable license template management
- `/app/deliveries`
  - delivery monitoring and merchant recovery tools
- `/app/settings`
  - storage, delivery email configuration, catalog setup health, advanced diagnostics

### Transitional routes

- `/app/setup`
  - temporary compatibility route that redirects to `/app`
- `/app/storage`
  - temporary compatibility route that redirects to `/app/settings` or is absorbed into `Settings`

---

## Current System We Are Migrating

### Setup logic already exists

- setup status check: [app/services/metafieldSetup.ts](/Users/payan/producer-launchpad-app/app/services/metafieldSetup.ts#L298)
- full setup execution: [app/services/metafieldSetup.ts](/Users/payan/producer-launchpad-app/app/services/metafieldSetup.ts#L710)

### Current onboarding UX is fragmented

- setup wizard: [app/routes/app.setup.tsx](/Users/payan/producer-launchpad-app/app/routes/app.setup.tsx#L151)
- storage page: [app/routes/app.storage.tsx](/Users/payan/producer-launchpad-app/app/routes/app.storage.tsx#L141)
- home auto-setup behavior: [app/routes/app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx#L49)
- upload gating: [app/routes/app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx#L58)

### Current app problem

The codebase has setup capability, but the merchant experience is split between multiple routes and hidden configuration.

---

## Success Criteria

After this roadmap is complete, a merchant should be able to:

1. Open the app and understand whether they are ready to sell.
2. Complete first-run setup without hunting for hidden routes.
3. Access storage and delivery configuration later through `Settings`.
4. Understand what Licenses controls in the product.
5. Trust that delivery is automated without needing to inspect technical internals.
6. Know what to do next from Home.

---

## Phase 0: Readiness Foundation

### Goal

Create one shared readiness model so Home, Settings, and guarded routes stop inventing their own setup logic.

### Deliverables

- New shared server helper, likely:
  - `app/services/appReadiness.server.ts`
- One readiness payload that combines:
  - `checkSetupStatus()`
  - storage connection state
  - producer existence
  - upload readiness
  - delivery configuration readiness if available

### Suggested readiness shape

- `needsProfile`
- `needsCoreSetup`
- `needsStorage`
- `isReady`
- `catalogHealth`
- `storageHealth`
- `blockingReason`

### Files to touch

- new: `app/services/appReadiness.server.ts`
- [app/routes/app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx)
- [app/routes/app.setup.tsx](/Users/payan/producer-launchpad-app/app/routes/app.setup.tsx)
- [app/routes/app.storage.tsx](/Users/payan/producer-launchpad-app/app/routes/app.storage.tsx)
- [app/routes/app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx)

### Notes

- Home should stop auto-running `runFullSetup()` on load.
- The readiness helper should be read-only. Mutation should stay in explicit actions.

### Exit criteria

- one shared readiness source exists
- no route invents its own setup-state interpretation

---

## Phase 1: Settings Page and Navigation Fix

### Goal

Restore accessible permanent configuration and clean up app nav.

### Deliverables

- New route:
  - `app/routes/app.settings.tsx`
- Add `Settings` to nav in [app/routes/app.tsx](/Users/payan/producer-launchpad-app/app/routes/app.tsx)
- Move storage configuration into `Settings`
- Add a merchant-facing `Catalog setup health` section
- Add `Advanced diagnostics` disclosure for technical details

### Settings IA

#### Section 1: Storage and delivery

- storage mode
- self-managed R2 connection
- managed storage summary

#### Section 2: Delivery email

- sender / status summary
- template status
- CTA to customize later

#### Section 3: Catalog setup health

- merchant-facing health states:
  - `Ready`
  - `Needs repair`
  - `Repairing`
- single action:
  - `Run repair`

#### Section 4: Advanced diagnostics

- product metafields
- variant metafields
- metaobject definitions
- seeded licenses / genres / producers
- exact repair errors

### Files to touch

- new: `app/routes/app.settings.tsx`
- [app/routes/app.tsx](/Users/payan/producer-launchpad-app/app/routes/app.tsx)
- [app/routes/app.storage.tsx](/Users/payan/producer-launchpad-app/app/routes/app.storage.tsx)
- [app/routes/app.setup.tsx](/Users/payan/producer-launchpad-app/app/routes/app.setup.tsx)

### Notes

- Avoid exposing "metafield seeding" language.
- Use merchant language:
  - `Catalog setup health`
  - `Store connection`
  - `Run repair`

### Exit criteria

- merchants can reach storage and system health from nav
- no critical config is stranded behind an old setup flow

---

## Phase 2: Home Becomes Get Started / Overview

### Goal

Give Home a real job.

### Deliverables

- Replace current dead stats homepage in [app/routes/app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx)
- Reuse onboarding wizard content from [app/routes/app.setup.tsx](/Users/payan/producer-launchpad-app/app/routes/app.setup.tsx#L282)
- Home should branch into 2 modes:
  - `Get started`
  - `Overview`

### Home: Get started mode

- Step 1: Producer profile
- Step 2: Preset confirmation
- Step 3: Storage setup
- CTA to upload first beat after completion

### Home: Overview mode

- automation health card
- quick actions
- compact license snapshot
- compact delivery email snapshot
- optional recent issue summary

### What to remove

- auto-setup on page load
- fake KPI cards
- repeated app-name-as-page-purpose framing

### Files to touch

- [app/routes/app._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app._index.tsx)
- [app/routes/app.setup.tsx](/Users/payan/producer-launchpad-app/app/routes/app.setup.tsx)
- maybe new shared home/onboarding components:
  - `app/components/onboarding/*`

### Exit criteria

- Home answers:
  - am I ready to sell?
  - is automation healthy?
  - what should I do next?

---

## Phase 3: Route Guard Cleanup

### Goal

Make route redirects match the new IA.

### Deliverables

- redirect incomplete stores to `/app`
- redirect settings/config issues to `/app/settings`
- remove dependency on `/app/setup` as the canonical first-run destination

### Files to touch

- [app/routes/app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx#L58)
- [app/routes/app.storage.tsx](/Users/payan/producer-launchpad-app/app/routes/app.storage.tsx#L152)
- any route still linking directly to `/app/setup`

### Exit criteria

- no important flow points merchants to the wrong surface

---

## Phase 4: Licenses Page Finalization

### Goal

Make Licenses clearly own reusable commercial-use templates.

### Target page purpose

The Licenses page should answer:

- what licensing options do I offer?
- what rights come with each?
- what gets delivered?
- which beats use each template?
- is each template ready to sell?

### Deliverables

- keep full-width `IndexTable`
- keep columns:
  - `License`
  - `Rights`
  - `Delivery package`
  - `Used by`
  - `Status`
  - `Edit`
- keep popovers for dense details
- keep `licenseName` as the single merchant-facing label

### Later enhancement within this phase

- add row action or link from `Used by` beats to catalog
- sharpen status rules if needed

### Files to touch

- [app/routes/app.licenses.tsx](/Users/payan/producer-launchpad-app/app/routes/app.licenses.tsx)
- maybe related services if usage queries need refinement

### Exit criteria

- Licenses no longer feels like a disconnected metadata page

---

## Phase 5: Dedicated License Editor

### Goal

Move beyond modal-only editing into a richer template editor.

### Deliverables

- New route:
  - `app/routes/app.licenses.$id.tsx` or equivalent nested editor route
- Two-column layout:
  - left = editable form
  - right = preview / impact / automation summary

### Editor sections

- `Identity`
- `Rights and limits`
- `Delivery package`
- `Agreement terms`

### Sidebar / secondary column

- `Customer preview`
- `Automation summary`
- `Used by beats`

### Why later

- the index page must be stable first
- this is a richer pattern and should not be rushed before IA cleanup

### Exit criteria

- editing a license feels intentional and understandable for non-technical producers

---

## Phase 6: Beats and Licenses Integration

### Goal

Make the relationship between beats and license templates explicit.

### Deliverables

- from beat upload/edit:
  - easier linking to license templates
  - clearer explanation of which licenses are applied
- from license page:
  - actionable `Used by`
  - links or filtered entry points into Beats

### Files to touch

- [app/routes/app.beats.new.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats.new.tsx)
- [app/routes/app.beats._index.tsx](/Users/payan/producer-launchpad-app/app/routes/app.beats._index.tsx)
- [app/routes/app.licenses.tsx](/Users/payan/producer-launchpad-app/app/routes/app.licenses.tsx)
- shared beat upload components

### Exit criteria

- merchants can move naturally between "what I sell" and "under what terms I sell it"

---

## Phase 7: Deliveries Positioning and Polish

### Goal

Keep Deliveries narrowly focused on post-purchase operations.

### Deliverables

- maintain delivery email status as an operational surface
- keep resend and recovery actions here
- tighten copy so the page is clearly internal-facing
- avoid duplicating license template data here

### Optional additions

- automation health callouts for failed deliveries
- better empty states
- clearer escalation language

### Exit criteria

- merchants understand Deliveries is where they monitor exceptions, not where they configure offers

---

## Phase 8: Retire Legacy Setup Surface

### Goal

Remove the old IA once the new one is live.

### Deliverables

- redirect `/app/setup` to `/app`
- merge or retire `/app/storage`
- remove stale buttons/copy referring to Setup as a primary page

### Exit criteria

- no visible dead-end setup concepts remain in the app

---

## Phase 9: QA and Validation

### Goal

Make sure the new IA actually works.

### QA checklist

- merchant can complete first-run setup from Home
- merchant can later find storage and repair actions in Settings
- upload guard redirects to the correct modern surface
- app name returns to Home cleanly
- nav contains only purposeful pages
- Licenses reflects actual beat usage
- Deliveries still works unchanged for operational recovery
- mobile and narrow-width layout checks pass

---

## Recommended Ticket Breakdown

### Epic 1: Shared readiness and settings recovery

- Ticket 1: Build `appReadiness.server.ts`
- Ticket 2: Add `/app/settings`
- Ticket 3: Move storage UI into Settings
- Ticket 4: Add catalog setup health + repair surface
- Ticket 5: Add advanced diagnostics disclosure

### Epic 2: Home rebuild

- Ticket 6: Remove auto-setup from Home
- Ticket 7: Port setup wizard into Home
- Ticket 8: Add ready-state Overview
- Ticket 9: Replace fake KPIs with automation/value cards

### Epic 3: Routing cleanup

- Ticket 10: Update redirects from `/app/setup`
- Ticket 11: Update redirects from `/app/storage`
- Ticket 12: Retire legacy setup route

### Epic 4: Licenses and catalog integration

- Ticket 13: Finalize Licenses table state model
- Ticket 14: Add dedicated license editor route
- Ticket 15: Add Beats ↔ Licenses linking

### Epic 5: Delivery and final polish

- Ticket 16: Keep Deliveries focused on operations
- Ticket 17: Add Home automation health summaries
- Ticket 18: Regression and responsive QA

---

## Implementation Order

Do the work in this order:

1. Shared readiness model
2. Settings page
3. Home rebuild
4. Redirect cleanup
5. Licenses stabilization
6. Dedicated license editor
7. Beats ↔ Licenses integration
8. Deliveries polish
9. Retire legacy setup surfaces
10. QA pass

---

## Non-Goals

This plan does not include:

- redesigning storefront theme UI
- turning Deliveries into a customer-facing page
- exposing raw metafield seeding to normal merchants
- inventing analytics dashboards without real merchant value

---

## Summary

The architectural fix is simple:

- Home becomes onboarding first, overview second
- Settings becomes the permanent configuration surface
- Licenses becomes the reusable offer-template manager
- Deliveries remains the fulfillment monitor

That gives Producer Launchpad a structure merchants can understand without knowing anything about Shopify internals.
