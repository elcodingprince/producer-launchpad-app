import type { ActionFunctionArgs } from "@remix-run/node";
import crypto from "crypto";
import prisma from "~/db.server";
import { recordPrivacyDataRequest } from "~/services/privacyRequests.server";
import { authenticate } from "~/shopify.server";

function normalizeShopDomain(shop: string) {
  return shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

async function deleteShopData(shop: string) {
  const normalizedShop = normalizeShopDomain(shop);

  await prisma.deliveryAccess.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.order.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.shopStorageConfig.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.session.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.privacyDataRequest.deleteMany({
    where: { shop: normalizedShop },
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const normalizedShop = normalizeShopDomain(shop);

  console.log(`Received webhook for ${normalizedShop}: ${topic}`);

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
      const customerEmail =
        typeof payload === "object" &&
        payload !== null &&
        "customer" in payload &&
        payload.customer &&
        typeof payload.customer === "object" &&
        "email" in payload.customer
          ? String(payload.customer.email || "")
          : "";

      if (customerEmail) {
        const matchingRecords = await prisma.deliveryAccess.findMany({
          where: {
            shop: normalizedShop,
            customerEmail,
          },
        });

        for (const record of matchingRecords) {
          await prisma.deliveryAccess.update({
            where: { id: record.id },
            data: {
              customerName: null,
              customerEmail: "",
              downloadToken: `redacted_${crypto.randomBytes(16).toString("hex")}`,
              deliveryEmailRecipient: null,
              deliveryEmailError: null,
              deliveryEmailMessageId: null,
              deliveryEmailConfirmedStatus: null,
              deliveryEmailConfirmedAt: null,
              deliveryEmailConfirmedError: null,
              deliveryEmailLastEvent: null,
              deliveryEmailLastEventAt: null,
            },
          });
        }
      }

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
