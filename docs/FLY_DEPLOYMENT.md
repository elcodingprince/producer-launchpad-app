# Fly.io Deployment Guide

This is the production-safe Fly.io setup for Producer Launchpad.

## What This Setup Assumes

- the app runs from the checked-in `Dockerfile`
- agreement PDFs are generated with Chromium
- production data lives in PostgreSQL, not on a Fly volume
- database migrations run as a Fly release command before each deploy

## Files Used

- `Dockerfile`
- `fly.toml`

## Why PostgreSQL Is Required

The app should not use SQLite in production.

For an embedded Shopify app that is meant to support hundreds of stores, production needs:

- concurrent connections from more than one app instance
- durable backups and operational tooling
- safe deploys that do not depend on a single mounted disk
- a database engine that matches development and production

Use a managed PostgreSQL database and store the connection string as a Fly secret.

`fly.toml` now uses a Fly `release_command` to run `npm run db:migrate:deploy` before the new release is promoted.

## First-Time Commands

Run these from the repo root:

Create the Fly app if needed, then set secrets:

```bash
fly secrets set \
  DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/producer_launchpad_prod?sslmode=require \
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

### Database choice

Fly supports release commands in `fly.toml`, and Fly documents `release_command` as the place to run one-off tasks like database migrations before a deploy is promoted.

You can use Fly Managed Postgres or any other managed PostgreSQL provider that gives the app a stable connection string.

Do not put the production `DATABASE_URL` in source control.

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
3. Confirm the Fly release command applied Prisma migrations successfully
4. Test:
   - install
   - reinstall
   - onboarding
   - delivery portal
   - license PDF download
   - order webhook path
