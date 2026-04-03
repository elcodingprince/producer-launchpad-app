ALTER TABLE "Order"
ADD COLUMN "shopifyCustomerId" TEXT;

ALTER TABLE "DeliveryAccess"
ADD COLUMN "shopifyCustomerId" TEXT;

CREATE INDEX "Order_shop_shopifyCustomerId_idx"
ON "Order"("shop", "shopifyCustomerId");

CREATE INDEX "DeliveryAccess_shop_shopifyCustomerId_idx"
ON "DeliveryAccess"("shop", "shopifyCustomerId");
