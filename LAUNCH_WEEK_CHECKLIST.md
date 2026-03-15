# Producer Launchpad Launch Week Checklist

Use this alongside [LAUNCH_PLAN.md](/Users/payan/producer-launchpad-app/LAUNCH_PLAN.md).

This document is the short operational checklist for the actual launch push.

---

## 1. Production Setup

- [ ] Hosted app URL is live and stable
- [ ] Shopify app configuration uses the hosted URL
- [ ] checkout extension app URL/config points to the hosted app
- [ ] Resend production env values are set
- [ ] `DELIVERY_EMAIL_FROM` is correct
- [ ] production database is migrated

---

## 2. Delivery Flow Validation

- [ ] Place a live storefront order for a single-file license
- [ ] Confirm thank-you block opens the portal
- [ ] Confirm delivery email arrives
- [ ] Confirm email portal link works
- [ ] Confirm PDF download works
- [ ] Confirm single-file audio download works

- [ ] Place a live storefront order for a multi-file license
- [ ] Confirm thank-you block opens the portal
- [ ] Confirm delivery email arrives
- [ ] Confirm email portal link works
- [ ] Confirm PDF download works
- [ ] Confirm ZIP download works

- [ ] Place a live storefront order containing multiple beats in one checkout
- [ ] Confirm one order creates one portal
- [ ] Confirm portal shows all purchased items
- [ ] Confirm the Items popover in Deliveries reflects the grouped order correctly

---

## 3. Merchant Operations Validation

- [ ] Open Deliveries in the embedded app
- [ ] Confirm `Delivery email` badges render correctly
- [ ] Confirm `Token access` badges render correctly
- [ ] Confirm customer popover looks correct
- [ ] Confirm items popover looks correct
- [ ] Confirm tracked download counts update after downloads
- [ ] Confirm `Copy portal link` works
- [ ] Confirm `Regenerate access link` works
- [ ] Confirm old token becomes invalid after regeneration
- [ ] Confirm `Resend delivery email` works
- [ ] Confirm resent emails return to `Delivered` after webhook confirmation

---

## 4. Failure Handling Validation

- [ ] Confirm invalid portal token shows a customer-friendly error
- [ ] Confirm missing file mapping shows a customer-friendly error
- [ ] Confirm partial delivery messaging is understandable
- [ ] Confirm missing/failed email send does not block portal creation
- [ ] Confirm merchant can still recover the order from Deliveries if email fails

---

## 5. Launch Decision

Launch only if all of the following are true:

- [ ] checkout block works on hosted production
- [ ] email recovery works on hosted production
- [ ] portal downloads work for single-file and ZIP orders
- [ ] merchant recovery works
- [ ] no delivery-critical flow still depends on changing preview URLs
- [ ] any remaining issues are non-blocking and moved to post-launch backlog

---

## 6. Hard Stop After Launch

Once launch is complete:

- [ ] stop adding non-essential features
- [ ] accept only production bug fixes and launch-blocking corrections
- [ ] move deferred work back to [LAUNCH_PLAN.md](/Users/payan/producer-launchpad-app/LAUNCH_PLAN.md) post-launch backlog
