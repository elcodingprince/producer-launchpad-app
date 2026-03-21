-- CreateTable
CREATE TABLE "ShopCatalogConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "stemsAddonProductId" TEXT,
    "stemsAddonVariantId" TEXT,
    "stemsAddonHandle" TEXT,
    "stemsAddonTitle" TEXT,
    "stemsAddonPrice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopCatalogConfig_shop_key" ON "ShopCatalogConfig"("shop");
