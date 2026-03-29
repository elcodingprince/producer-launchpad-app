# Render Deployment Guide

This app can be deployed to Render tonight without changing the current PDF generation flow.

## Why This Setup

Producer Launchpad currently:

- runs as a Remix/Node server
- uses Prisma with SQLite
- generates agreement PDFs by converting HTML with headless Chromium

That means the safest fast path is:

- Render `Web Service`
- `Docker` deploy
- `Persistent Disk`

## Files Added For Render

- `Dockerfile`
- `.dockerignore`

The Docker image installs Chromium and uses the existing runtime startup flow:

- `npm run docker-start`

That command runs:

- `prisma generate`
- `prisma db push`
- `remix-serve ./build/server/index.js`

## Render Service Setup

Create a new `Web Service` in Render and choose:

- Runtime: `Docker`
- Plan: paid plan
- Region: same region you expect to operate from if possible

## Persistent Disk

Attach a persistent disk to the web service.

Recommended settings:

- Mount path: `/data`
- Size: `1 GB` is enough to start

## Required Environment Variables

Set these in Render:

- `NODE_ENV=production`
- `PORT=10000`
- `CHROME_PATH=/usr/bin/chromium`
- `DATABASE_URL=file:/data/producer-launchpad.sqlite`
- `SHOPIFY_API_KEY=...`
- `SHOPIFY_API_SECRET=...`
- `SHOPIFY_APP_URL=https://YOUR-APP-HOST`
- `SHOPIFY_APP_SCOPES=read_products,write_products,read_publications,write_publications,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_orders,write_app_proxy`
- `SESSION_SECRET=...`
- `BUNNY_STORAGE_ZONE=...`
- `BUNNY_STORAGE_PASSWORD=...`
- `BUNNY_PULL_ZONE=...`
- `BUNNY_REGION=...`
- `RESEND_API_KEY=...`
- `DELIVERY_EMAIL_FROM=Producer Launchpad <downloads@YOUR-DOMAIN>`
- `DELIVERY_EMAIL_REPLY_TO=newradio.sound@gmail.com`
- `DELIVERY_EMAIL_BRAND_NAME=Producer Launchpad`
- `RESEND_WEBHOOKS_ENABLED=false`
- `RESEND_WEBHOOK_SECRET=...` if webhook handling is enabled

## Important Notes

### 1. Keep a single instance

This deployment keeps SQLite for speed. Do not scale horizontally with this setup.

Use:

- `1` instance only

### 2. The app URL must be real

After the first successful deploy, use the live Render URL or your custom domain as:

- `SHOPIFY_APP_URL`
- Shopify App URL
- Shopify allowed redirect URLs
- any checkout extension app URL setting that points back to the app

### 3. This is the submit-tonight setup

This setup is practical for getting the app live quickly.

Later improvements can include:

- moving from SQLite to Postgres
- adding more formal backup handling
- adding stricter production observability

## Deploy Order

1. Push this branch.
2. Create the Render web service from the repo.
3. Attach the persistent disk.
4. Add the environment variables.
5. Deploy.
6. Open the live URL and verify the app boots.
7. Update Shopify app URLs and redirects.
8. Test:
   - install
   - reinstall
   - onboarding
   - order webhook
   - delivery portal
   - PDF download

## If PDF Generation Fails

Check the app logs for:

- missing Chromium executable
- filesystem write issues
- timeout during HTML-to-PDF generation

This image sets:

- `CHROME_PATH=/usr/bin/chromium`

If Chromium is installed correctly, the current PDF generation path should work without changing app code.
