PRAGMA foreign_keys=OFF;

CREATE TABLE "DeliveryAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "downloadToken" TEXT NOT NULL,
    "deliveryEmailStatus" TEXT NOT NULL DEFAULT 'pending',
    "deliveryEmailSentAt" DATETIME,
    "deliveryEmailError" TEXT,
    "deliveryEmailRecipient" TEXT,
    "deliveryEmailMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "DeliveryAccess" (
    "id",
    "orderId",
    "shop",
    "customerEmail",
    "customerName",
    "downloadToken",
    "deliveryEmailStatus",
    "deliveryEmailSentAt",
    "deliveryEmailError",
    "deliveryEmailRecipient",
    "deliveryEmailMessageId",
    "createdAt",
    "updatedAt"
)
SELECT
    lower(hex(randomblob(4))) || lower(hex(randomblob(4))) || lower(hex(randomblob(4))),
    "id",
    "shop",
    "customerEmail",
    "customerName",
    "downloadToken",
    COALESCE("deliveryEmailStatus", 'pending'),
    "deliveryEmailSentAt",
    "deliveryEmailError",
    "deliveryEmailRecipient",
    "deliveryEmailMessageId",
    "createdAt",
    "updatedAt"
FROM "Order";

CREATE UNIQUE INDEX "DeliveryAccess_orderId_key" ON "DeliveryAccess"("orderId");
CREATE UNIQUE INDEX "DeliveryAccess_downloadToken_key" ON "DeliveryAccess"("downloadToken");
CREATE INDEX "DeliveryAccess_shop_idx" ON "DeliveryAccess"("shop");
CREATE INDEX "DeliveryAccess_downloadToken_idx" ON "DeliveryAccess"("downloadToken");

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active'
);

INSERT INTO "new_Order" (
    "id",
    "shop",
    "shopifyOrderId",
    "orderNumber",
    "createdAt",
    "updatedAt",
    "status"
)
SELECT
    "id",
    "shop",
    "shopifyOrderId",
    "orderNumber",
    "createdAt",
    "updatedAt",
    "status"
FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");
CREATE INDEX "Order_shop_shopifyOrderId_idx" ON "Order"("shop", "shopifyOrderId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
