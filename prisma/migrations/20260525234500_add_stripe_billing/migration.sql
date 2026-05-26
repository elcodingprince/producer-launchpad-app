CREATE TABLE "ShopStripeBilling" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'missing',
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "accessOverride" TEXT,
    "lastStripeEventId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopStripeBilling_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shop" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopStripeBilling_shop_key" ON "ShopStripeBilling"("shop");
CREATE UNIQUE INDEX "ShopStripeBilling_stripeSubscriptionId_key" ON "ShopStripeBilling"("stripeSubscriptionId");
CREATE INDEX "ShopStripeBilling_shop_subscriptionStatus_idx" ON "ShopStripeBilling"("shop", "subscriptionStatus");
CREATE INDEX "ShopStripeBilling_stripeCustomerId_idx" ON "ShopStripeBilling"("stripeCustomerId");
