/*
  Warnings:

  - Added the required column `filePurpose` to the `BeatFile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BeatFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beatId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePurpose" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BeatFile" ("beatId", "createdAt", "fileType", "filename", "id", "size", "storageUrl", "updatedAt") SELECT "beatId", "createdAt", "fileType", "filename", "id", "size", "storageUrl", "updatedAt" FROM "BeatFile";
DROP TABLE "BeatFile";
ALTER TABLE "new_BeatFile" RENAME TO "BeatFile";
CREATE INDEX "BeatFile_beatId_idx" ON "BeatFile"("beatId");
CREATE INDEX "BeatFile_beatId_filePurpose_idx" ON "BeatFile"("beatId", "filePurpose");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
