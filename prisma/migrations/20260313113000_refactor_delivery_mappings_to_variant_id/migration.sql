PRAGMA foreign_keys=OFF;

CREATE TABLE "new_LicenseFileMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LicenseFileMapping_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "BeatFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "LicenseFileMapping";
ALTER TABLE "new_LicenseFileMapping" RENAME TO "LicenseFileMapping";
CREATE INDEX "LicenseFileMapping_variantId_idx" ON "LicenseFileMapping"("variantId");
CREATE INDEX "LicenseFileMapping_fileId_idx" ON "LicenseFileMapping"("fileId");

CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shopifyLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "beatTitle" TEXT NOT NULL,
    "licenseName" TEXT NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_OrderItem" ("id", "orderId", "shopifyLineId", "productId", "variantId", "beatTitle", "licenseName", "downloadCount", "createdAt")
SELECT "id", "orderId", "shopifyLineId", "productId", "variantId", "beatTitle", "licenseName", "downloadCount", "createdAt"
FROM "OrderItem";

DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
