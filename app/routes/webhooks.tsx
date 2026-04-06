import type { ActionFunctionArgs } from "@remix-run/node";
import {
  extractCustomerIdentifiers,
  redactCustomerData,
  runPrivacyMaintenanceForShop,
} from "~/services/privacyCompliance.server";
import { recordPrivacyDataRequest } from "~/services/privacyRequests.server";
import {
  queueShopDeletionJob,
  triggerQueuedShopDeletionProcessing,
} from "~/services/shopDeletionJobs.server";
import { authenticate } from "~/shopify.server";

function normalizeShopDomain(shop: string) {
  return shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const normalizedShop = normalizeShopDomain(shop);

  console.log(`Received webhook for ${normalizedShop}: ${topic}`);
  await runPrivacyMaintenanceForShop(normalizedShop);

  switch (topic) {
    case "APP_UNINSTALLED": {
      const job = await queueShopDeletionJob(normalizedShop, "app_uninstalled");
      void triggerQueuedShopDeletionProcessing();
      console.log(
        `Queued managed-storage deletion job ${job.id} after uninstall: ${normalizedShop}`,
      );
      break;
    }

    case "CUSTOMERS_DATA_REQUEST": {
      const requestResult = await recordPrivacyDataRequest(
        normalizedShop,
        payload as Record<string, unknown>,
      );

      console.log(
        `Customer data request for ${normalizedShop}: stored request ${requestResult.privacyRequest.shopifyDataRequestId} with ${requestResult.matchingOrders.length} matched order(s)`,
      );
      break;
    }

    case "CUSTOMERS_REDACT": {
      const customer = extractCustomerIdentifiers(
        payload as Record<string, unknown>,
      );
      await redactCustomerData(normalizedShop, customer);

      console.log(`Customer redact processed for ${normalizedShop}`);
      break;
    }

    case "SHOP_REDACT": {
      const job = await queueShopDeletionJob(normalizedShop, "shop_redact");
      void triggerQueuedShopDeletionProcessing();
      console.log(
        `Queued shop redact deletion job ${job.id} for ${normalizedShop}`,
      );
      break;
    }

    default: {
      console.log(`Unhandled webhook topic: ${topic}`);
    }
  }

  return new Response(null, { status: 200 });
};
