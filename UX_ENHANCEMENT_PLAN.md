# UX_ENHANCEMENT_PLAN.md

## 1. UX Goals

### Primary outcome
Enable producers to complete this path with minimal friction:

Install app -> Configure storage -> Upload beat -> Sell licenses

### UX goals
1. Reduce onboarding confusion around storage configuration.
2. Enforce correct file-to-license mapping before publish.
3. Prevent customers receiving incorrect download files.
4. Block beat uploads until storage setup is complete.
5. Preserve advanced self-managed storage support (R2, Bunny, S3).

### Success metrics
1. Time-to-first-upload < 10 minutes for managed hosting path.
2. Storage setup failure rate reduced by 50%.
3. Upload validation failure at publish stage reduced by 70%.
4. Post-purchase wrong-file incidents reduced to near zero.

---

## 2. Updated User Flows

## 2.1 Onboarding flow (updated)
1. Install app.
2. Setup Wizard Step 1-3 (schema, producer profile, licenses/genres).
3. Setup Wizard Step 4: File Hosting (required).
4. Setup Wizard Step 5: Final readiness check.
5. Continue to Upload Beat.

Hard rule: `/app/beats/new` is gated until storage status is `connected`.

## 2.2 Storage setup flow (Step 4 of 5)

### Managed path (recommended)
1. User selects `NRS Managed Hosting`.
2. Clicks `Start Hosting`.
3. Redirect to Stripe Checkout.
4. On success webhook/callback:
- create per-store storage folder/prefix
- mark storage config as `connected`
5. Show `Storage Ready`.
6. Continue to upload.

### Advanced path (self-managed)
1. User selects `Connect Your Own Storage`.
2. Chooses provider: R2 / Bunny / S3.
3. Enters credentials and bucket/zone info.
4. Clicks `Test connection`.
5. On success: save encrypted credentials, mark `connected`.
6. Show `Storage Ready`.
7. Continue to upload.

## 2.3 Beat upload flow (license-first)
1. Step 1: Beat details (title, BPM, key, genre(s), producer(s)).
2. Step 2: Upload cover art + preview audio.
3. Step 3: Upload files by license tier (not by type).
4. Step 4: Validation + customer download preview.
5. Step 5: Create product + variants + metafields.

---

## 3. Wireframes

## 3.1 Setup Wizard — Step 4 of 5 (File Hosting)

```text
Setup Wizard — Step 4 of 5
File Hosting

How would you like to host your beat files?

[ RECOMMENDED ]
NRS Managed Hosting
$50 / month

We host your beat files so you can focus on selling.

✓ Instant uploads
✓ Fast global delivery
✓ Secure license downloads

[ Start Hosting ]

---------------------------------------------

[ ADVANCED SETUP ]
Connect Your Own Storage
Free

Supported providers:
• Cloudflare R2
• Bunny Storage
• Amazon S3

[ Connect Storage ]
```

## 3.2 Storage Ready screen

```text
✓ Storage Connected

Provider: Cloudflare R2
Bucket: beats-storage
Status: Ready for uploads

[ Continue ]
```

## 3.3 License-first upload UI

```text
Beat: Midnight Drift

Basic License
Required File
[ Upload MP3 ]

---------------------------------------------

Premium License
Required File
[ Upload WAV ]

---------------------------------------------

Unlimited License
Required Files
[ Upload WAV ]
[ Upload Stems ZIP ]
```

## 3.4 Validation status panel

```text
Before Publishing

Basic License
✓ MP3 uploaded

Premium License
⚠ WAV missing

Unlimited License
⚠ Stems missing
```

Publish/Upload CTA stays disabled until all required files are valid.

## 3.5 Customer Download Preview (producer-facing)

```text
Customer Download Preview

Basic License
✓ tagged_mp3.mp3

Premium License
✓ tagged_mp3.mp3
✓ wav_master.wav

Unlimited License
✓ tagged_mp3.mp3
✓ wav_master.wav
✓ stems.zip
```

---

## 4. Implementation Breakdown

## 4.1 IA and navigation updates
1. Add `Storage & Delivery` page to app nav.
2. Include setup progress indicator with `Step 4: File Hosting`.
3. Add persistent storage status badge in Dashboard and Setup.

## 4.2 Storage configuration model
Per-shop config in app DB:
1. mode: `managed` | `self_managed`
2. provider: `r2` | `bunny` | `s3`
3. status: `disconnected` | `connected` | `error`
4. encrypted credentials
5. bucket/zone and public base URL
6. `lastTestedAt`, `errorType`, `lastError`

## 4.3 Setup Wizard Step 4 behavior
1. Default to managed option for first-time users.
2. Show advanced section only after explicit selection.
3. Require successful connection test before continuing on self-managed path.
4. Block completion if storage remains disconnected.

## 4.4 Upload UX refactor to license-first
1. Replace generic file-type grouping with license cards.
2. For each license card, render required file slots.
3. Auto-map uploaded files into per-license bundle model.
4. Add pre-publish preview of exact customer downloads.

## 4.5 Product + variant creation pipeline
1. Create/update product.
2. Create/update variants for each license tier.
3. For each variant, write download URL/bundle URL into:
- `variant.metafields.custom.download_bundle`
4. Keep product-level preview URL metafield for storefront player.

## 4.6 Error handling UX
1. If storage `disconnected`: hard redirect to storage setup.
2. If storage `error`: soft warning banner, allow access, block publish until valid.
3. Inline per-license validation errors.
4. Actionable messages by error type (`auth`, `bucket`, `network`, `permission`).

## 4.7 Rollout plan
1. Phase 1: Storage wizard + gating + managed placeholder + provider testing.
2. Phase 2: License-first uploader + validation + preview panel.
3. Phase 3: Stripe managed billing activation + provider expansion.

---

## 5. Required API Interactions

## 5.1 Shopify Admin API
1. Product create/update.
2. Variant create/update per license tier.
3. Variant metafield write:
- namespace: `custom`
- key: `download_bundle`
4. Optional product metafields for preview metadata.

## 5.2 Storage APIs
### Self-managed providers
1. Credential validation (`test connection`).
2. File upload operations.
3. Return public/CDN URL for each bundle.

### Managed provider
1. Internal provider SDK/client upload.
2. Per-shop prefix isolation:
- `users/{store_id}/{beat_slug}/...`
3. Return public/CDN URL for saved assets.

## 5.3 Stripe APIs (managed hosting)
1. Checkout session create.
2. Subscription status webhook handling.
3. Provision/deprovision managed storage state by subscription status.

---

## 6. Validation Logic

## 6.1 Setup-stage validation
1. Storage mode selected.
2. Managed mode: subscription active (or trial active).
3. Self-managed mode: connection test passed.
4. Save blocked on failed validation.

## 6.2 Upload-stage validation
1. Global required fields:
- title, BPM, key, producer(s), genre(s), preview
2. License requirements:
- Basic: MP3 required
- Premium: WAV required
- Unlimited: WAV + Stems ZIP required
3. File type/size constraints enforced per slot.
4. Upload button disabled until all required slots pass.

## 6.3 Mapping integrity validation
Before publish:
1. Every active license variant has exactly one valid download bundle URL.
2. Preview panel resolves files correctly per license.
3. Reject publish if any variant has missing/invalid mapping.

## 6.4 Post-create verification
1. Confirm product created.
2. Confirm all target variants exist.
3. Confirm metafield `custom.download_bundle` saved for each variant.
4. Show success only if all checks pass.

---

## 7. Future Enhancement Hooks (Not in MVP)

1. Batch beat uploader.
2. Automatic preview generation.
3. Automatic beat tagging.
4. Desktop uploader app.
5. Signed download URLs.
6. Automatic license bundle generation.

### Hook points to add now (without full implementation)
1. Provider adapter interface:
- `testConnection()`, `upload()`, `delete()`, `getUrl()`
2. License requirement schema config:
- data-driven mapping by license ID.
3. Validation engine module:
- reusable pre-publish checks.
4. Download delivery abstraction:
- supports future signed URL delivery.
5. Background job queue boundary:
- supports future batch upload and processing.

---

## Final Implementation Goal

After implementation, producers should reliably complete:

Install app -> Configure storage -> Upload beat -> Sell licenses

The system must enforce correct license-to-file mapping and prevent incomplete or incorrect variant download delivery.
