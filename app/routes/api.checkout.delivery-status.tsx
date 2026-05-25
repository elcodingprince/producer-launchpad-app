import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import { buildDownloadPortalUrl } from "~/services/appUrl.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function normalizeShopDomain(dest?: string) {
  if (!dest) return "";
  try {
    return new URL(dest).hostname;
  } catch {
    return dest.replace(/^https?:\/\//, "");
  }
}

function normalizeOrderId(orderId: string | null) {
  if (!orderId) return null;
  const match = orderId.match(/\/(\d+)$/);
  return match ? match[1] : orderId;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const { sessionToken } = await authenticate.public.checkout(request, {
    corsHeaders: ["Authorization", "Content-Type"],
  });

  const body = await request.json();
  const normalizedOrderId = normalizeOrderId(body?.orderId ?? null);

  if (!normalizedOrderId) {
    return json(
      { status: "failed", message: "orderId is required" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const shop = normalizeShopDomain(sessionToken.dest);

  const access = await prisma.deliveryAccess.findFirst({
    where: {
      shop,
      order: {
        shopifyOrderId: normalizedOrderId,
      },
    },
    select: {
      downloadToken: true,
    },
  });

  if (!access?.downloadToken) {
    return json({ status: "loading" }, { headers: CORS_HEADERS });
  }

  return json(
    {
      status: "ready",
      downloadUrl: buildDownloadPortalUrl(access.downloadToken, request),
    },
    { headers: CORS_HEADERS },
  );
};
