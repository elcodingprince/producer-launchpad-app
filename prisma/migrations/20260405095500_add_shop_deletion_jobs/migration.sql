-- CreateTable
CREATE TABLE "ShopDeletionJob" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "queuedFileCount" INTEGER NOT NULL DEFAULT 0,
    "deletedFileCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDeletionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDeletionQueueItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "beatFileId" TEXT,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDeletionQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopDeletionJob_shop_createdAt_idx" ON "ShopDeletionJob"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "ShopDeletionJob_status_nextAttemptAt_idx" ON "ShopDeletionJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopDeletionQueueItem_jobId_storageKey_key" ON "ShopDeletionQueueItem"("jobId", "storageKey");

-- CreateIndex
CREATE INDEX "ShopDeletionQueueItem_jobId_status_idx" ON "ShopDeletionQueueItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "ShopDeletionQueueItem_shop_status_idx" ON "ShopDeletionQueueItem"("shop", "status");

-- AddForeignKey
ALTER TABLE "ShopDeletionQueueItem" ADD CONSTRAINT "ShopDeletionQueueItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ShopDeletionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDeletionQueueItem" ADD CONSTRAINT "ShopDeletionQueueItem_beatFileId_fkey" FOREIGN KEY ("beatFileId") REFERENCES "BeatFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
