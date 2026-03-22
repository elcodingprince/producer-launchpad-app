CREATE TABLE "ExecutedAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "templateMetaobjectId" TEXT,
    "templateHandle" TEXT NOT NULL,
    "offerArchetype" TEXT NOT NULL,
    "templateVersion" TEXT,
    "resolvedLicenseJson" TEXT NOT NULL,
    "beatOfferSnapshotJson" TEXT NOT NULL,
    "stemsIncludedInOrder" BOOLEAN NOT NULL DEFAULT false,
    "licensorSnapshotJson" TEXT NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "htmlHash" TEXT NOT NULL,
    "pdfData" BLOB,
    "pdfHash" TEXT,
    "pdfStatus" TEXT NOT NULL DEFAULT 'pending',
    "pdfError" TEXT,
    "buyerEmail" TEXT,
    "buyerIp" TEXT,
    "userAgent" TEXT,
    "purchasedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExecutedAgreement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExecutedAgreement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExecutedAgreement_orderItemId_key" ON "ExecutedAgreement"("orderItemId");
CREATE INDEX "ExecutedAgreement_shop_idx" ON "ExecutedAgreement"("shop");
CREATE INDEX "ExecutedAgreement_orderId_idx" ON "ExecutedAgreement"("orderId");
CREATE INDEX "ExecutedAgreement_templateHandle_idx" ON "ExecutedAgreement"("templateHandle");
CREATE INDEX "ExecutedAgreement_purchasedAt_idx" ON "ExecutedAgreement"("purchasedAt");
