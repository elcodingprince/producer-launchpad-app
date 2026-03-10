-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "ShopStorageConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'disconnected',
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "accountId" TEXT,
    "bucketName" TEXT,
    "publicBaseUrl" TEXT,
    "accessKeyIdEnc" TEXT,
    "secretAccessKeyEnc" TEXT,
    "lastTestedAt" DATETIME,
    "lastError" TEXT,
    "errorType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BeatFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beatId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LicenseFileMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beatId" TEXT NOT NULL,
    "licenseTier" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LicenseFileMapping_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "BeatFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopStorageConfig_shop_key" ON "ShopStorageConfig"("shop");

-- CreateIndex
CREATE INDEX "BeatFile_beatId_idx" ON "BeatFile"("beatId");

-- CreateIndex
CREATE INDEX "LicenseFileMapping_beatId_licenseTier_idx" ON "LicenseFileMapping"("beatId", "licenseTier");

-- CreateIndex
CREATE INDEX "LicenseFileMapping_fileId_idx" ON "LicenseFileMapping"("fileId");
