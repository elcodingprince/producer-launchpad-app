import { json, type LoaderFunctionArgs } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import { buildDownloadPortalUrl } from "~/services/appUrl.server";

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
  // Handle CORS preflight (OPTIONS) — no auth needed for preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // For GET requests, authenticate and return empty (primary logic is in action/POST)
  const { cors } = await authenticate.public.checkout(request, {
    corsHeaders: ["Authorization", "Content-Type"],
  });
  return cors(new Response(null, { status: 204 }));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Handle CORS preflight if it lands here
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const { sessionToken, cors } = await authenticate.public.checkout(request, {
    corsHeaders: ["Authorization", "Content-Type"],
  });
  const body = await request.json();
  const normalizedOrderId = normalizeOrderId(body?.orderId ?? null);

  if (!normalizedOrderId) {
    return cors(
      json(
        { status: "failed", message: "orderId is required" },
        { status: 400 }
      )
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
    return cors(
      json({
        status: "loading",
      })
    );
  }

  return cors(
    json({
      status: "ready",
      downloadUrl: buildDownloadPortalUrl(access.downloadToken, request),
    })
  );
};
