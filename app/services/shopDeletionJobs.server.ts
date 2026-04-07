import prisma from "~/db.server";
import { getConfiguredAppOrigin } from "~/services/appUrl.server";
import { deleteR2Object } from "~/services/r2.server";
import { getManagedR2Credentials } from "~/services/storageConfig.server";
import { deleteShopData } from "~/services/privacyCompliance.server";

const ACTIVE_JOB_STATUSES = ["pending", "running", "retrying"] as const;
const RETRYABLE_ITEM_STATUSES = ["pending", "retrying"] as const;
const SHOP_DELETION_WINDOW_DAYS = 7;
const SHOP_REDACT_WINDOW_DAYS = 2;
const MAX_FILE_DELETE_ATTEMPTS = 8;
const RETRY_BACKOFF_MINUTES = [5, 30, 120, 360, 720, 1440];

type ShopDeletionTrigger = "app_uninstalled" | "shop_redact" | "manual";

function normalizeShopDomain(shop: string) {
  return shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function daysFromNow(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
}

function minutesFromNow(minutes: number) {
  const value = new Date();
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function getDeadlineForTrigger(trigger: ShopDeletionTrigger) {
  if (trigger === "shop_redact") {
    return daysFromNow(SHOP_REDACT_WINDOW_DAYS);
  }

  return daysFromNow(SHOP_DELETION_WINDOW_DAYS);
}

function getNextRetryTime(attemptCount: number) {
  const minutes =
    RETRY_BACKOFF_MINUTES[Math.min(attemptCount, RETRY_BACKOFF_MINUTES.length - 1)];
  return minutesFromNow(minutes);
}

function getObjectKeyFromUrl(storageUrl: string, bucketName: string) {
  const url = new URL(storageUrl);
  const path = url.pathname.replace(/^\/+/, "");
  const bucketPrefix = `${bucketName}/`;

  return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
}

function resolveStorageKey(
  file: { storageKey?: string | null; storageUrl: string },
  bucketName: string,
) {
  return file.storageKey?.trim() || getObjectKeyFromUrl(file.storageUrl, bucketName);
}

async function buildDeletionItemInputs(shop: string) {
  const bucketName = getManagedR2Credentials()?.bucketName || null;

  const beatFiles = await prisma.beatFile.findMany({
    where: { shop },
    select: {
      id: true,
      storageKey: true,
      storageUrl: true,
    },
  });

  return beatFiles
    .map((file) => {
      const storageKey =
        file.storageKey?.trim() ||
        (bucketName ? resolveStorageKey(file, bucketName) : null);

      if (!storageKey) {
        return null;
      }

      return {
        shop,
        beatFileId: file.id,
        storageKey,
        status: "pending" as const,
      };
    })
    .filter(Boolean) as Array<{
    shop: string;
    beatFileId: string;
    storageKey: string;
    status: "pending";
  }>;
}

async function getExistingActiveJob(shop: string) {
  return prisma.shopDeletionJob.findFirst({
    where: {
      shop,
      status: {
        in: [...ACTIVE_JOB_STATUSES],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function queueShopDeletionJob(
  shop: string,
  trigger: ShopDeletionTrigger,
) {
  const normalizedShop = normalizeShopDomain(shop);
  const deadlineAt = getDeadlineForTrigger(trigger);
  const itemInputs = await buildDeletionItemInputs(normalizedShop);
  const existingJob = await getExistingActiveJob(normalizedShop);

  if (existingJob) {
    const currentCount = await prisma.shopDeletionQueueItem.count({
      where: { jobId: existingJob.id },
    });

    if (itemInputs.length > 0) {
      await prisma.shopDeletionQueueItem.createMany({
        data: itemInputs.map((item) => ({
          ...item,
          jobId: existingJob.id,
        })),
        skipDuplicates: true,
      });
    }

    const totalCount = await prisma.shopDeletionQueueItem.count({
      where: { jobId: existingJob.id },
    });

    return prisma.shopDeletionJob.update({
      where: { id: existingJob.id },
      data: {
        trigger,
        status: existingJob.status === "running" ? existingJob.status : "pending",
        nextAttemptAt: new Date(),
        deadlineAt:
          deadlineAt < existingJob.deadlineAt ? deadlineAt : existingJob.deadlineAt,
        queuedFileCount: Math.max(currentCount, totalCount),
        lastError: null,
      },
    });
  }

  return prisma.shopDeletionJob.create({
    data: {
      shop: normalizedShop,
      trigger,
      status: "pending",
      deadlineAt,
      nextAttemptAt: new Date(),
      queuedFileCount: itemInputs.length,
      items: {
        create: itemInputs,
      },
    },
  });
}

async function markJobForRetry(
  jobId: string,
  attemptCount: number,
  error: string,
) {
  await prisma.shopDeletionJob.update({
    where: { id: jobId },
    data: {
      status: "retrying",
      nextAttemptAt: getNextRetryTime(attemptCount),
      lastError: error,
    },
  });
}

async function finalizeJob(jobId: string, shop: string, deletedFileCount: number) {
  await deleteShopData(shop);

  await prisma.shopDeletionJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      nextAttemptAt: null,
      lastError: null,
      deletedFileCount,
    },
  });
}

async function processSingleJob(
  jobId: string,
  expectedStatus: string,
  batchSize: number,
) {
  const job = await prisma.shopDeletionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return { processed: false, completed: false, deletedCount: 0 };
  }

  const attemptCount = job.attemptCount + 1;

  const claimed = await prisma.shopDeletionJob.updateMany({
    where: {
      id: job.id,
      status: expectedStatus,
    },
    data: {
      status: "running",
      startedAt: job.startedAt || new Date(),
      attemptCount,
      nextAttemptAt: null,
      lastError: null,
    },
  });

  if (claimed.count === 0) {
    return { processed: false, completed: false, deletedCount: 0 };
  }

  const creds = getManagedR2Credentials();

  if (!creds) {
    await markJobForRetry(
      job.id,
      attemptCount,
      "Managed storage credentials are not configured for deletion processing.",
    );

    return { processed: true, completed: false, deletedCount: 0 };
  }

  const items = await prisma.shopDeletionQueueItem.findMany({
    where: {
      jobId: job.id,
      status: {
        in: [...RETRYABLE_ITEM_STATUSES],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: batchSize,
  });

  if (items.length === 0) {
    const deletedCount = await prisma.shopDeletionQueueItem.count({
      where: {
        jobId: job.id,
        status: "deleted",
      },
    });

    await finalizeJob(job.id, job.shop, deletedCount);
    return { processed: true, completed: true, deletedCount };
  }

  let encounteredRetryableFailure = false;

  for (const item of items) {
    try {
      await deleteR2Object(
        {
          accountId: creds.accountId,
          bucketName: creds.bucketName,
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          key: item.storageKey,
        },
        { ignoreMissing: true },
      );

      await prisma.shopDeletionQueueItem.update({
        where: { id: item.id },
        data: {
          status: "deleted",
          attemptCount: item.attemptCount + 1,
          deletedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const nextAttemptCount = item.attemptCount + 1;
      const message =
        error instanceof Error ? error.message : "Unknown storage deletion error";
      const terminal = nextAttemptCount >= MAX_FILE_DELETE_ATTEMPTS;

      await prisma.shopDeletionQueueItem.update({
        where: { id: item.id },
        data: {
          status: terminal ? "failed" : "retrying",
          attemptCount: nextAttemptCount,
          lastError: message,
        },
      });

      if (!terminal) {
        encounteredRetryableFailure = true;
      }
    }
  }

  const [remainingRetryableCount, terminalFailureCount, deletedCount] =
    await Promise.all([
      prisma.shopDeletionQueueItem.count({
        where: {
          jobId: job.id,
          status: {
            in: [...RETRYABLE_ITEM_STATUSES],
          },
        },
      }),
      prisma.shopDeletionQueueItem.count({
        where: {
          jobId: job.id,
          status: "failed",
        },
      }),
      prisma.shopDeletionQueueItem.count({
        where: {
          jobId: job.id,
          status: "deleted",
        },
      }),
    ]);

  if (terminalFailureCount > 0) {
    await prisma.shopDeletionJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        nextAttemptAt: null,
        lastError:
          "One or more uploaded file objects could not be deleted after repeated attempts.",
        deletedFileCount: deletedCount,
      },
    });

    return { processed: true, completed: false, deletedCount };
  }

  if (remainingRetryableCount === 0) {
    await finalizeJob(job.id, job.shop, deletedCount);
    return { processed: true, completed: true, deletedCount };
  }

  await prisma.shopDeletionJob.update({
    where: { id: job.id },
    data: {
      status: encounteredRetryableFailure ? "retrying" : "pending",
      nextAttemptAt: encounteredRetryableFailure
        ? getNextRetryTime(attemptCount)
        : new Date(),
      lastError: encounteredRetryableFailure
        ? "One or more uploaded file objects failed to delete and were rescheduled."
        : null,
      deletedFileCount: deletedCount,
    },
  });

  return { processed: true, completed: false, deletedCount };
}

export async function processQueuedShopDeletionJobs(options?: {
  maxJobs?: number;
  batchSize?: number;
}) {
  const maxJobs = Math.max(1, Math.min(options?.maxJobs || 1, 10));
  const batchSize = Math.max(1, Math.min(options?.batchSize || 25, 100));
  const now = new Date();
  const staleRunningCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const jobs = await prisma.shopDeletionJob.findMany({
    where: {
      status: {
        in: ["pending", "retrying", "running"],
      },
      OR: [
        {
          status: {
            in: ["pending", "retrying"],
          },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          status: "running",
          startedAt: { lt: staleRunningCutoff },
        },
      ],
    },
    orderBy: [{ deadlineAt: "asc" }, { createdAt: "asc" }],
    take: maxJobs,
  });

  let processedJobs = 0;
  let completedJobs = 0;

  for (const job of jobs) {
    const result = await processSingleJob(job.id, job.status, batchSize);
    if (result.processed) processedJobs += 1;
    if (result.completed) completedJobs += 1;
  }

  return {
    processedJobs,
    completedJobs,
  };
}

export async function getPendingShopDeletionJobCount() {
  return prisma.shopDeletionJob.count({
    where: {
      status: {
        in: ["pending", "retrying", "running"],
      },
    },
  });
}

export async function triggerQueuedShopDeletionProcessing() {
  const appUrl = getConfiguredAppOrigin();
  const internalJobSecret = process.env.INTERNAL_JOB_SECRET?.trim();

  if (!appUrl || !internalJobSecret) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(`${appUrl.replace(/\/$/, "")}/api/internal/shop-deletion-jobs`, {
      method: "POST",
      headers: {
        "x-internal-job-secret": internalJobSecret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ maxJobs: 1, batchSize: 25 }),
      signal: controller.signal,
    });

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
