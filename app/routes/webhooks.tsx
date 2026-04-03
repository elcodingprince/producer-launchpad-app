import type { ActionFunctionArgs } from "@remix-run/node";
import {
  deleteShopData,
  extractCustomerIdentifiers,
  redactCustomerData,
  runPrivacyMaintenanceForShop,
} from "~/services/privacyCompliance.server";
import { recordPrivacyDataRequest } from "~/services/privacyRequests.server";
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
      await deleteShopData(normalizedShop);
      console.log(`Cleaned shop data after uninstall: ${normalizedShop}`);
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
      await deleteShopData(normalizedShop);
      console.log(`Shop redact processed for ${normalizedShop}`);
      break;
    }

    default: {
      console.log(`Unhandled webhook topic: ${topic}`);
    }
  }

  return new Response(null, { status: 200 });
};
