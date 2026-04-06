CREATE TABLE "MerchantAcknowledgment" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "acknowledgmentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptedByUserId" BIGINT,
    "acceptedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantAcknowledgment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantAcknowledgment_shop_acknowledgmentKey_version_key"
ON "MerchantAcknowledgment"("shop", "acknowledgmentKey", "version");

CREATE INDEX "MerchantAcknowledgment_shop_idx"
ON "MerchantAcknowledgment"("shop");

CREATE INDEX "MerchantAcknowledgment_acknowledgmentKey_idx"
ON "MerchantAcknowledgment"("acknowledgmentKey");
