# Resend + React Email Implementation Plan

## Purpose

This document defines the first app-owned delivery email system for Producer Launchpad.

It is intentionally scoped to:

- transactional delivery emails only
- a single secure portal-link email flow
- app-branded sending infrastructure
- merchant-personalized content where useful

It does not replace Shopify's native order confirmation emails.

---

## Product Direction

### Primary recovery model

Customers should receive:

- instant access from the checkout thank-you block
- durable recovery through an app-owned delivery email

Merchant recovery inside the embedded app remains available as a support path.

### Sending model

V1 should send from the app's own domain and brand infrastructure, not merchant-owned domains.

Recommended sender model:

- From: `Producer Launchpad <downloads@producerlaunchpad.com>`
- Subject pattern: `Your files are ready from {Store Name}`

This keeps setup simple and scalable while still allowing merchant personalization inside the email body.

### Branding model

V1 email branding should support:

- merchant/store name
- optional merchant logo
- optional support email

The delivery infrastructure and sender domain remain Producer Launchpad-owned.

---

## Technology Choice

### Provider

Use Resend for V1.

Why:

- strong React Email compatibility
- simple Node/Remix integration
- good transactional-email ergonomics
- enough free-tier capacity for implementation/testing
- event/webhook support for later delivery-status tracking

### Template system

Use React Email for the template layer.

Why:

- fits the existing React codebase
- easy to build and iterate branded email markup
- reusable components for future emails

---

## What We Are Sending

### V1 delivery email contents

Required:

- customer-facing headline that files are ready
- merchant/store name
- secure portal CTA button
- text fallback link
- item summary
- support fallback copy

Optional in V1:

- merchant logo
- brief order summary

Deferred:

- MP3/WAV/ZIP attachments
- multi-email lifecycle campaigns
- merchant-owned sender domains

### Attachment decision

V1 should not attach audio deliverables.

Optional later:

- attach the generated PDF license agreement if the PDF flow becomes stable enough to include as an attachment

The canonical delivery path for actual files remains the secure portal.

---

## Trigger Strategy

### Initial send trigger

Send the delivery email after the order is persisted and a valid `downloadToken` exists.

Current best insertion point:

- after successful `orders/create` webhook persistence

Reason:

- token already exists there
- no second delivery system is needed
- keeps the email tied to the same portal URL customers already use

### Failure behavior

Email send failure must not block delivery.

If sending fails:

- order and token still remain valid
- checkout block still works
- merchant recovery still works
- send failure is logged for later support visibility

---

## Implementation Shape

### 1. Provider abstraction

Create an app-level email service abstraction so provider code stays isolated.

Suggested files:

- `app/services/email.server.ts`
- `app/services/emailProviders/resend.server.ts`

Suggested interface:

- `sendDeliveryEmail({ orderId, to, subject, portalUrl, ... })`

### 2. Email template layer

Create a dedicated delivery email template using React Email.

Suggested files:

- `app/emails/DeliveryReadyEmail.tsx`
- optional shared email UI components under `app/emails/components/`

Template responsibilities:

- render merchant/store branding
- render order/download summary
- render secure CTA
- render fallback text link

### 3. Merchant branding source

V1 can source branding from existing shop/app setup data if available.

Needed values:

- store name
- optional logo URL
- optional support email

If those values are not fully modeled yet:

- start with store name only
- add logo/support fields in a later setup pass

### 4. Delivery email orchestration

Add orchestration in the order webhook flow after token creation.

Suggested initial behavior:

- if order has downloadable items and customer email exists:
  - build portal URL
  - send delivery email once

### 5. Send tracking

Add delivery email tracking to Prisma so support can see what happened.

Suggested initial fields on `Order`:

- `deliveryEmailStatus` (`pending`, `sent`, `failed`)
- `deliveryEmailSentAt`
- `deliveryEmailError`
- `deliveryEmailRecipient`

If we want more detail later, add a dedicated email log table.

### 6. Merchant resend support

After automatic sending works, add a resend action to Deliveries.

Suggested action:

- `Resend delivery email`

This should reuse the same active token unless the merchant explicitly regenerates the link first.

---

## Environment and Configuration

### Required environment variables

Expected V1 env vars:

- `RESEND_API_KEY`
- `DELIVERY_EMAIL_FROM`
- optional `DELIVERY_EMAIL_REPLY_TO`

### Domain setup

V1 should verify a single Producer Launchpad-controlled sending domain in Resend.

Do not require per-merchant DNS/domain configuration.

---

## Customer Experience Rules

### Email UX

The email should feel branded and trustworthy, but not overloaded.

The customer should immediately understand:

- their files are ready
- where to click
- what happens if the link fails

### Link behavior

The email must reuse the same portal token flow already used by:

- checkout thank-you block
- merchant copy-link recovery

Do not create a second token model for email.

---

## Operational Rules

### Idempotency

Webhook retries must not send duplicate delivery emails uncontrolled.

Implementation should ensure:

- an already-sent delivery email is not resent automatically on duplicate webhook processing
- resend is only triggered deliberately by merchant action later

### Logging

Minimum logging for V1:

- send attempt started
- send success
- send failure with provider error summary

### Monitoring

Deferred for now, but the implementation should make later monitoring easy by preserving provider responses and error text.

---

## Phased Delivery

### Phase A: Foundation

- install Resend SDK
- install React Email dependencies
- add env configuration
- add provider abstraction

### Phase B: First send

- create `DeliveryReadyEmail`
- send after order persistence
- track sent/failed status in Prisma

### Phase C: Merchant operations

- show email send state in Deliveries
- add merchant resend button

### Phase D: Refinement

- merchant logo/support customization
- optional PDF attachment
- better delivery analytics

---

## Definition of Done for V1

V1 is complete when:

- a qualifying order creates a secure `downloadToken`
- the app sends a delivery email through Resend
- the email contains the working portal link
- failure to send does not block checkout or merchant recovery
- Prisma records whether the delivery email was sent or failed

---

## Explicit Non-Goals for V1

- replacing Shopify's native order confirmation email
- merchant-owned sending domains
- customer marketing automation
- audio-file attachments
- multi-step campaign logic
