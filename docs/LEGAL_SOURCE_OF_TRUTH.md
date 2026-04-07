# Producer Launchpad Legal Source Of Truth

This file is the canonical index for privacy, terms, and retention language used
to update the app UI, public website, and listing materials.

## Canonical Documents

Use only these files as the source of truth:

- `privacy-policy-app-behavior-draft.md`
  Public privacy-policy source. This should drive:
  - `producer-launchpad-site/src/pages/privacy.astro`
  - privacy/disclosure copy in the app
  - App Store privacy answers and review notes

- `terms-of-service-app-behavior-draft.md`
  Public merchant-terms source. This should drive:
  - `producer-launchpad-site/src/pages/terms.astro`
  - merchant-responsibility and disclaimer copy in the app
  - App Store legal/support materials

- `data-retention-policy.md`
  Internal retention and deletion source. This should drive:
  - privacy and terms retention language
  - uninstall / redact deletion promises
  - operational cleanup behavior

## Supporting Documents

These support implementation and review, but are not public-policy sources:

- `privacy-compliance-audit-2026-04-05.md`
  Audit record and gap analysis.

- `PRE_SUBMISSION_CHECKLIST.md`
  Submission tracker.

- `FLY_DEPLOYMENT.md`
- `RENDER_DEPLOYMENT.md`
  Operational deployment notes, including cleanup-job scheduling.

## Deprecated For Policy Drafting

Do not draft public privacy or terms copy from these files:

- `privacy-policy.md`
- `merchant-data-processing.md`

They are retained only as historical references and should point back here.

## Working Rule

Before editing legal/privacy copy anywhere else:

1. Update the canonical doc here first.
2. Mirror the same language into app UI copy if needed.
3. Mirror the same language into the public site.
4. Do one final consistency pass.
