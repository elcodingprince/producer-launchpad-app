-- Replace global order idempotency with shop-scoped order idempotency.
DROP INDEX IF EXISTS "Order_shopifyOrderId_key";
DROP INDEX IF EXISTS "Order_shop_shopifyOrderId_idx";

CREATE UNIQUE INDEX "Order_shop_shopifyOrderId_key"
ON "Order"("shop", "shopifyOrderId");

-- Track paid-order webhook processing separately from delivery order records.
CREATE TABLE "ProcessedOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'orders/paid',
    "productIdsJson" TEXT NOT NULL DEFAULT '[]',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metafieldsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedOrder_shop_shopifyOrderId_topic_key"
ON "ProcessedOrder"("shop", "shopifyOrderId", "topic");

CREATE INDEX "ProcessedOrder_shop_processedAt_idx"
ON "ProcessedOrder"("shop", "processedAt");

CREATE TABLE "ProductLicenseCount" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLicenseCount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductLicenseCount_shop_shopifyProductId_key"
ON "ProductLicenseCount"("shop", "shopifyProductId");

CREATE INDEX "ProductLicenseCount_shop_idx"
ON "ProductLicenseCount"("shop");

CREATE TABLE "VariantLicenseCount" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantLicenseCount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariantLicenseCount_shop_shopifyVariantId_key"
ON "VariantLicenseCount"("shop", "shopifyVariantId");

CREATE INDEX "VariantLicenseCount_shop_idx"
ON "VariantLicenseCount"("shop");

CREATE INDEX "VariantLicenseCount_shop_shopifyProductId_idx"
ON "VariantLicenseCount"("shop", "shopifyProductId");
