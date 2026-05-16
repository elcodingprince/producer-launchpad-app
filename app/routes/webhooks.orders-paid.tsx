import type { ActionFunctionArgs } from "@remix-run/node";
import {
  fetchPaidOrderLicenseLineItems,
  markPaidOrderLicenseMetafieldsSynced,
  recordPaidOrderLicenseCounts,
  syncProductLicenseCountMetafields,
} from "~/services/licenseCounts.server";
import { authenticate, unauthenticated } from "~/shopify.server";

function normalizeShopifyResourceId(value: unknown) {
  const id = String(value || "").trim();
  if (!id) return "";
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const shopifyOrderId = normalizeShopifyResourceId((payload as any).id);

  if (!shopifyOrderId) {
    return new Response("Missing order id", { status: 400 });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const lineItems = await fetchPaidOrderLicenseLineItems({
      shopifyOrderId,
      admin,
    });

    if (lineItems.length === 0) {
      return new Response("No paid license line items found", { status: 200 });
    }

    const result = await recordPaidOrderLicenseCounts({
      shop,
      shopifyOrderId,
      lineItems,
    });

    if (
      result.state !== "already_synced" &&
      result.affectedProductIds.length > 0
    ) {
      await syncProductLicenseCountMetafields({
        shop,
        productIds: result.affectedProductIds,
        admin,
      });
      await markPaidOrderLicenseMetafieldsSynced({
        shop,
        shopifyOrderId,
      });
    }

    return new Response(`License counts ${result.state}`, { status: 200 });
  } catch (error) {
    console.error(
      `[License counts] Failed to process paid order ${shopifyOrderId} for ${shop}:`,
      error,
    );
    return new Response("Internal error", { status: 500 });
  }
};
