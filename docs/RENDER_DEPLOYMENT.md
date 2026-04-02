# Render Deployment Guide

This app can be deployed to Render without changing the current PDF generation flow.

## Why This Setup

Producer Launchpad currently:

- runs as a Remix/Node server
- uses Prisma with PostgreSQL
- generates agreement PDFs by converting HTML with headless Chromium

That means the safest fast path is:

- Render `Web Service`
- `Docker` deploy
- managed PostgreSQL

## Files Added For Render

- `Dockerfile`
- `.dockerignore`

The Docker image installs Chromium and starts the app with:

- `npm run start`

Run `npm run db:migrate:deploy` as part of your deployment process before the new app revision handles traffic.

## Render Service Setup

Create a new `Web Service` in Render and choose:

- Runtime: `Docker`
- Plan: paid plan
- Region: same region you expect to operate from if possible

## Required Environment Variables

Set these in Render:

- `NODE_ENV=production`
- `PORT=10000`
- `CHROME_PATH=/usr/bin/chromium`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/producer_launchpad_prod?sslmode=require`
- `SHOPIFY_API_KEY=...`
- `SHOPIFY_API_SECRET=...`
- `SHOPIFY_APP_URL=https://YOUR-APP-HOST`
- `SHOPIFY_APP_SCOPES=read_products,write_products,read_publications,write_publications,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_orders,write_app_proxy`
- `SESSION_SECRET=...`
- `CF_R2_ACCOUNT_ID=...`
- `CF_R2_BUCKET_NAME=...`
- `CF_R2_ACCESS_KEY_ID=...`
- `CF_R2_SECRET_ACCESS_KEY=...`
- `CF_R2_PUBLIC_BASE_URL=...`
- `RESEND_API_KEY=...`
- `DELIVERY_EMAIL_FROM=Producer Launchpad <downloads@YOUR-DOMAIN>`
- `DELIVERY_EMAIL_REPLY_TO=newradio.sound@gmail.com`
- `DELIVERY_EMAIL_BRAND_NAME=Producer Launchpad`
- `RESEND_WEBHOOKS_ENABLED=false`
- `RESEND_WEBHOOK_SECRET=...` if webhook handling is enabled

## Important Notes

### 1. Use PostgreSQL in production

Do not use SQLite for production app data. The app is intended to support many stores, and production should use a managed PostgreSQL service.

### 2. The app URL must be real

After the first successful deploy, use the live Render URL or your custom domain as:

- `SHOPIFY_APP_URL`
- Shopify App URL
- Shopify allowed redirect URLs
- any checkout extension app URL setting that points back to the app

### 3. This is the submit-tonight setup

This setup is practical for getting the app live quickly.

Later improvements can include:

- connection pooling
- more formal backup handling
- stricter production observability

## Deploy Order

1. Push this branch.
2. Create the Render web service from the repo.
3. Add the environment variables.
4. Ensure `npm run db:migrate:deploy` runs before the release is promoted.
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
