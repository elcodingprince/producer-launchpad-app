import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import { buildDownloadPortalUrl } from "~/services/appUrl.server";

function normalizeOrderId(orderId: string | null) {
  if (!orderId) return null;

  const match = orderId.match(/\/(\d+)$/);
  return match ? match[1] : orderId;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const normalizedOrderId = normalizeOrderId(url.searchParams.get("orderId"));

  if (!normalizedOrderId) {
    return json(
      { status: "failed", message: "orderId is required" },
      { status: 400 },
    );
  }

  const access = await prisma.deliveryAccess.findFirst({
    where: {
      shop: session.shop,
      order: {
        shopifyOrderId: normalizedOrderId,
      },
    },
    select: {
      downloadToken: true,
    },
  });

  if (!access?.downloadToken) {
    return json({ status: "loading" });
  }

  return json({
    status: "ready",
    downloadUrl: buildDownloadPortalUrl(access.downloadToken, request),
  });
};
