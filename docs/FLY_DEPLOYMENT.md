# Fly.io Deployment Guide

This is the fastest practical Fly.io setup for Producer Launchpad tonight.

## What This Setup Assumes

- the app runs from the checked-in `Dockerfile`
- agreement PDFs are generated with Chromium
- SQLite remains the production database for tonight
- the app runs on a single Fly machine

## Files Used

- `Dockerfile`
- `fly.toml`

## Why A Volume Is Required

The app currently uses Prisma with SQLite.

That means the database file must live on a Fly volume, not the default ephemeral filesystem.

This config mounts the volume at:

- `/data`

and sets:

- `DATABASE_URL=file:/data/producer-launchpad.sqlite`

## First-Time Commands

Run these from the repo root:

```bash
fly volumes create producer_launchpad_data --region lax --size 1 -a producer-launchpad-app
```

Then set secrets:

```bash
fly secrets set \
  SHOPIFY_API_KEY=... \
  SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://producer-launchpad-app.fly.dev \
  SHOPIFY_APP_SCOPES=read_products,write_products,read_publications,write_publications,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_orders,write_app_proxy \
  SESSION_SECRET=... \
  CF_R2_ACCOUNT_ID=... \
  CF_R2_BUCKET_NAME=... \
  CF_R2_ACCESS_KEY_ID=... \
  CF_R2_SECRET_ACCESS_KEY=... \
  CF_R2_PUBLIC_BASE_URL=... \
  RESEND_API_KEY=... \
  DELIVERY_EMAIL_FROM='Producer Launchpad <downloads@YOUR-DOMAIN>' \
  DELIVERY_EMAIL_REPLY_TO=newradio.sound@gmail.com \
  DELIVERY_EMAIL_BRAND_NAME='Producer Launchpad' \
  RESEND_WEBHOOKS_ENABLED=false \
  -a producer-launchpad-app
```

Then deploy:

```bash
fly deploy -a producer-launchpad-app
```

## Notes

### Single machine only

Do not scale horizontally with this SQLite setup.

### PDF generation

The Docker image installs Chromium and sets:

- `CHROME_PATH=/usr/bin/chromium`

That is required for HTML-to-PDF agreement generation.

### First live app URL

The first production URL will be:

- `https://producer-launchpad-app.fly.dev`

Use that first. You can attach a custom domain later.

## After Deploy

1. Verify the app responds at `https://producer-launchpad-app.fly.dev`
2. Update Shopify App URL and redirect URLs
3. Test:
   - install
   - reinstall
   - onboarding
   - delivery portal
   - license PDF download
   - order webhook path
