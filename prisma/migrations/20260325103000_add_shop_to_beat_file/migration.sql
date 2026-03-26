ALTER TABLE "BeatFile" ADD COLUMN "shop" TEXT NOT NULL DEFAULT '';

CREATE INDEX "BeatFile_shop_idx" ON "BeatFile"("shop");
CREATE INDEX "BeatFile_shop_beatId_filePurpose_idx" ON "BeatFile"("shop", "beatId", "filePurpose");
