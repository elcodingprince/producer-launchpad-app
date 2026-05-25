ALTER TABLE "LicenseFileMapping" ADD COLUMN "shop" TEXT;

UPDATE "LicenseFileMapping" AS mapping
SET "shop" = beat_file."shop"
FROM "BeatFile" AS beat_file
WHERE mapping."fileId" = beat_file."id";

UPDATE "LicenseFileMapping"
SET "shop" = ''
WHERE "shop" IS NULL;

ALTER TABLE "LicenseFileMapping" ALTER COLUMN "shop" SET NOT NULL;

CREATE INDEX "LicenseFileMapping_shop_idx" ON "LicenseFileMapping"("shop");
CREATE INDEX "LicenseFileMapping_shop_variantId_idx" ON "LicenseFileMapping"("shop", "variantId");
