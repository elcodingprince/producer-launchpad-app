# Initial Setup Wireframes (Reference)

## Purpose
- Capture wireframe options for first-time app experience.
- Keep both concepts for comparison during UX decisions:
  - `Option A`: Simple onboarding-first flow
  - `Option B`: Schema-aware flow matching structured metaobject requirements

---

## Option A - Simple Initial App State Flow

### App Purpose
Help producers go from `install -> setup -> first uploaded beat -> ready to sell` with minimal confusion.

### Proposed Initial Flow
1. First app open -> Welcome + readiness check
2. Guided setup:
   - Create producer profile
   - Confirm licenses
   - Confirm genres
   - Configure storage
3. Setup complete -> Go to upload beat
4. First successful upload -> My Beats shows real item

### Wireframe Set

#### Screen 1 - First Open (No Setup Yet)
```text
+------------------------------------------------------+
| Producer Launchpad                                   |
|------------------------------------------------------|
| Welcome, let's get your store ready                  |
| Upload and sell your first beat in a few steps.      |
|                                                      |
| Setup Progress: 0/4                                  |
| [ ] Producer profile                                 |
| [ ] Licenses                                         |
| [ ] Genres                                           |
| [ ] Storage                                          |
|                                                      |
| [ Start Setup ]                                      |
+------------------------------------------------------+
```

#### Screen 2 - Step 1 (Producer Profile)
```text
+------------------------------------------------------+
| Setup: Producer Profile (1/4)                        |
|------------------------------------------------------|
| Your producer name                                   |
| [____________________________]                       |
|                                                      |
| Optional bio                                         |
| [____________________________]                       |
|                                                      |
| [ Save & Continue ]                                  |
|                                                      |
| Need details? [ Show technical status ]              |
+------------------------------------------------------+
```

#### Screen 3 - Step 2/3 (Licenses + Genres Quick Confirm)
```text
+------------------------------------------------------+
| Setup: Catalog Basics (2/4, 3/4)                    |
|------------------------------------------------------|
| Licenses: 3 default tiers ready                      |
| [ Basic ] [ Premium ] [ Unlimited ]                  |
| [ Continue ]                                         |
|                                                      |
| Genres: 6 seeded genres ready                        |
| [ Trap ] [ Hip Hop ] [ R&B ] [ Drill ] ...          |
| [ Continue ]                                         |
+------------------------------------------------------+
```

#### Screen 4 - Step 4 (Storage)
```text
+------------------------------------------------------+
| Setup: Storage (4/4)                                 |
|------------------------------------------------------|
| Choose storage mode                                  |
| (•) Managed by Producer Launchpad                    |
| ( ) Self-managed (R2)                                |
|                                                      |
| [ Test Connection ]  [ Save & Finish Setup ]         |
+------------------------------------------------------+
```

#### Screen 5 - Setup Complete
```text
+------------------------------------------------------+
| Setup Complete                                       |
|------------------------------------------------------|
| You're ready to upload your first beat.              |
|                                                      |
| [ Upload First Beat ]                                |
| [ View Setup Details ]                               |
+------------------------------------------------------+
```

---

## Option B - Schema-Aware Initial Setup Flow (Recommended)

### Why this exists
The app relies on structured `genre` and `beat_license` metaobjects (not only display names), so setup must validate schema and seed complete entries.

### Flow
1. Preflight schema checks
2. Producer profile input
3. License template review/edit
4. Genre catalog review/edit
5. Metafield wiring check
6. Storage setup
7. Setup complete -> upload

### Wireframe
```text
+------------------------------------------------------------------+
| Producer Launchpad - First-Time Setup                            |
| Goal: make storefront-ready data, not just pass setup checks     |
+------------------------------------------------------------------+

STEP 0: Preflight (Auto-run)
[✓] Check required definitions exist
[✓] Check field types match expected schema
[✓] Check permissions/scopes
If any fail -> show "Fix Required" with exact mismatch + retry button


+------------------------------------------------------------------+
| STEP 1: Producer Profile (Required User Input)                   |
+------------------------------------------------------------------+
| Producer Name *  [________________________]                      |
| Producer Bio    [________________________]                       |
| Producer Image  [ Upload ] (optional)                            |
|                                                                  |
| [ Save Producer ]                                 (1/5 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 2: License Templates (Structured Metaobjects)               |
+------------------------------------------------------------------+
| We seeded 3 defaults with full terms: Basic / Premium / Unlimited|
|                                                                  |
| Basic     [ Edit ] [ Preview Terms ]                             |
| Premium   [ Edit ] [ Preview Terms ]                             |
| Unlimited [ Edit ] [ Preview Terms ]                             |
|                                                                  |
| Validation: all required fields present per license              |
| (license_id, display_name, terms/features, file format metadata) |
|                                                                  |
| [ Continue ]                                      (2/5 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 3: Genre Catalog (Structured Metaobjects)                   |
+------------------------------------------------------------------+
| We seeded 6 genres with full fields                              |
| (title, slug, description, brand color, icon, sort order)        |
|                                                                  |
| Trap       [ Edit ]                                               |
| Hip Hop    [ Edit ]                                               |
| R&B        [ Edit ]                                               |
| ...                                                              |
|                                                                  |
| [ Add Genre ] [ Reorder ]                                        |
| [ Continue ]                                      (3/5 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 4: Metafield Wiring Check                                   |
+------------------------------------------------------------------+
| Product metafields                                                |
| [✓] custom.bpm                    number_integer                 |
| [✓] custom.key                    single_line_text_field         |
| [✓] custom.produced_by            list.metaobject_reference      |
| [✓] custom.genre                  list.metaobject_reference      |
| [✓] custom.license_files_*        json                           |
|                                                                  |
| Variant metafields                                                |
| [✓] custom.license_reference      metaobject_reference           |
|                                                                  |
| [ Pin Definitions in Admin ] (optional UX visibility helper)     |
| [ Continue ]                                      (4/5 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 5: Storage & Delivery                                       |
+------------------------------------------------------------------+
| (•) Managed by Producer Launchpad                                |
| ( ) Self-managed Cloudflare R2                                   |
|                                                                  |
| [ Test Connection ]                                               |
| Status: Connected / Error                                         |
|                                                                  |
| [ Finish Setup ]                                  (5/5 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| SETUP COMPLETE                                                   |
+------------------------------------------------------------------+
| Store is fully configured for upload + storefront logic          |
|                                                                  |
| [ Upload First Beat ]                                             |
| [ View Config Summary ]                                           |
+------------------------------------------------------------------+
```

---

## Option C - "Smart Defaults" Flow (Recommended)

### Why this is the best approach
This approach borrows from your CRO-focused product page redesign (reducing visual clutter and cognitive load). It combines the **low-friction speed of Option A** with the **schema-safety and customization of Option B** using **Progressive Disclosure**. Technical checks run silently in the background, and customization is offered as an *optional* secondary path rather than a mandatory hurdle.

### Flow
1. **Background Magic**: Preflight schema & wiring checks run during the loading screen. No technical jargon is shown to the user unless a fatal error occurs.
2. **Step 1: Identity**: Producer Name (Required).
3. **Step 2: The Foundation (Licenses & Genres)**: Present industry-standard seeded data with a clear "Looks Good" primary button, and an optional "Customize" button for power users.
4. **Step 3: Storage**: Default to managed storage, secondary option for self-managed.
5. **Setup Complete -> Upload**

### Wireframe
```text
+------------------------------------------------------------------+
| Producer Launchpad - Welcome                                     |
+------------------------------------------------------------------+

[ Silent Check in Background: Schema, Metafields, Scopes ]
(If error: show troubleshooting UI. If success: show Step 1)

+------------------------------------------------------------------+
| STEP 1: Your Producer Profile                                    |
+------------------------------------------------------------------+
| Let's get your store ready. What's your producer or brand name?  |
|                                                                  |
| Name *  [________________________]                               |
| Bio     [________________________] (Optional)                    |
|                                                                  |
| [ Continue ]                                      (1/3 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 2: Catalog Presets                                          |
+------------------------------------------------------------------+
| We've pre-loaded your store with industry standards so you can   |
| start selling immediately.                                       |
|                                                                  |
| ✓ 3 License Tiers (Basic, Premium, Unlimited)                    |
| ✓ 6 Popular Genres (Trap, Hip Hop, R&B...)                       |
|                                                                  |
| [ Looks Good, Continue ] <-- Primary, frictionless action        |
|                                                                  |
| * Note: You can always customize these later in your Shopify     |
|   Admin under Content > Metaobjects.                             |
|                                                   (2/3 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| STEP 3: Storage Configuration                                    |
+------------------------------------------------------------------+
| Where should we securely store your high-quality audio files?    |
|                                                                  |
| (•) managed by Producer Launchpad (Recommended)                  |
| ( ) connect my own Cloudflare R2 bucket                          |
|                                                                  |
| [ Finish Setup ]                                  (3/3 complete) |
+------------------------------------------------------------------+


+------------------------------------------------------------------+
| SETUP COMPLETE                                                   |
+------------------------------------------------------------------+
| 🎉 Your beat store is ready.                                     |
|                                                                  |
| [ Upload Your First Beat ] <-- Big primary CTA                   |
+------------------------------------------------------------------+
```
