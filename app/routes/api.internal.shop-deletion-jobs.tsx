import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  getPendingShopDeletionJobCount,
  processQueuedShopDeletionJobs,
} from "~/services/shopDeletionJobs.server";

function getInternalJobSecret() {
  return process.env.INTERNAL_JOB_SECRET?.trim() || "";
}

function isAuthorized(request: Request) {
  const secret = getInternalJobSecret();

  if (!secret) {
    return false;
  }

  return request.headers.get("x-internal-job-secret") === secret;
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body =
    request.method === "POST"
      ? ((await request.json().catch(() => ({}))) as {
          maxJobs?: number;
          batchSize?: number;
        })
      : {};

  const [beforeCount, result] = await Promise.all([
    getPendingShopDeletionJobCount(),
    processQueuedShopDeletionJobs({
      maxJobs: body.maxJobs,
      batchSize: body.batchSize,
    }),
  ]);

  const refreshedCount = await getPendingShopDeletionJobCount();

  return json({
    pendingJobsBefore: beforeCount,
    pendingJobsAfter: refreshedCount,
    ...result,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return handleRequest(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleRequest(request);
};
