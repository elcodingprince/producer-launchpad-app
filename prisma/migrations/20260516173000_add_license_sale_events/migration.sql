CREATE TABLE "LicenseSaleEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'orders/paid',
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyLineItemId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseSaleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LicenseSaleEvent_shop_shopifyOrderId_shopifyLineItemId_topic_key"
ON "LicenseSaleEvent"("shop", "shopifyOrderId", "shopifyLineItemId", "topic");

CREATE INDEX "LicenseSaleEvent_shop_soldAt_idx"
ON "LicenseSaleEvent"("shop", "soldAt");

CREATE INDEX "LicenseSaleEvent_shop_shopifyProductId_soldAt_idx"
ON "LicenseSaleEvent"("shop", "shopifyProductId", "soldAt");

CREATE INDEX "LicenseSaleEvent_shop_shopifyVariantId_soldAt_idx"
ON "LicenseSaleEvent"("shop", "shopifyVariantId", "soldAt");
