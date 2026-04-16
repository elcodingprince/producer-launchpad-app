-- CreateTable
CREATE TABLE "ShopUploadPreference" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "lastUsedOfferSelectionJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopUploadPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopUploadPreference_shop_key" ON "ShopUploadPreference"("shop");
