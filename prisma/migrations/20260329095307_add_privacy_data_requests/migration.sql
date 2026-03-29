-- CreateTable
CREATE TABLE "PrivacyDataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyDataRequestId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "customerEmail" TEXT,
    "ordersRequestedJson" TEXT NOT NULL DEFAULT '[]',
    "requestPayloadJson" TEXT NOT NULL,
    "exportJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fulfilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyDataRequest_shop_shopifyDataRequestId_key" ON "PrivacyDataRequest"("shop", "shopifyDataRequestId");

-- CreateIndex
CREATE INDEX "PrivacyDataRequest_shop_status_idx" ON "PrivacyDataRequest"("shop", "status");

-- CreateIndex
CREATE INDEX "PrivacyDataRequest_shop_customerEmail_idx" ON "PrivacyDataRequest"("shop", "customerEmail");
