CREATE TABLE "BeatDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bpm" INTEGER,
    "key" TEXT,
    "producerAlias" TEXT,
    "genreGidsJson" TEXT NOT NULL DEFAULT '[]',
    "producerGidsJson" TEXT NOT NULL DEFAULT '[]',
    "licenseFilesJson" TEXT NOT NULL DEFAULT '{}',
    "licensePricesJson" TEXT NOT NULL DEFAULT '{}',
    "uploadedFilesJson" TEXT NOT NULL DEFAULT '[]',
    "previewFileJson" TEXT,
    "coverArtFileJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "BeatDraft_shop_idx" ON "BeatDraft"("shop");
CREATE INDEX "BeatDraft_shop_updatedAt_idx" ON "BeatDraft"("shop", "updatedAt");
