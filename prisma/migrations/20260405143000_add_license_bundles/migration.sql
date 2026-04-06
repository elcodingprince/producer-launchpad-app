-- CreateTable
CREATE TABLE "LicenseBundle" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "licenseMetaobjectId" TEXT NOT NULL,
    "licenseHandle" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseBundle_shop_normalizedName_key" ON "LicenseBundle"("shop", "normalizedName");

-- CreateIndex
CREATE INDEX "LicenseBundle_shop_idx" ON "LicenseBundle"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseBundleItem_bundleId_licenseMetaobjectId_key" ON "LicenseBundleItem"("bundleId", "licenseMetaobjectId");

-- CreateIndex
CREATE INDEX "LicenseBundleItem_bundleId_idx" ON "LicenseBundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "LicenseBundleItem_licenseMetaobjectId_idx" ON "LicenseBundleItem"("licenseMetaobjectId");

-- AddForeignKey
ALTER TABLE "LicenseBundleItem" ADD CONSTRAINT "LicenseBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "LicenseBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
