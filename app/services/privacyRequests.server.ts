import type {
  DeliveryAccess,
  ExecutedAgreement,
  Order,
  OrderItem,
  PrivacyDataRequest,
} from "@prisma/client";
import prisma from "~/db.server";

type ShopifyDataRequestPayload = {
  customer?: {
    id?: string | number | null;
    email?: string | null;
  } | null;
  data_request?: {
    id?: string | number | null;
  } | null;
  orders_requested?: Array<string | number> | null;
};

type OrderWithRelations = Order & {
  items: Array<OrderItem & { executedAgreement: ExecutedAgreement | null }>;
  deliveryAccess: DeliveryAccess | null;
};

function normalizeShopDomain(shop: string) {
  return shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseOrdersRequested(payload: ShopifyDataRequestPayload) {
  return (payload.orders_requested || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getShopifyDataRequestId(payload: ShopifyDataRequestPayload) {
  return (
    normalizeOptionalString(payload.data_request?.id) ||
    `missing-request-id-${Date.now()}`
  );
}

function sanitizeExecutedAgreement(
  agreement: ExecutedAgreement | null,
): Record<string, unknown> | null {
  if (!agreement) return null;

  return {
    id: agreement.id,
    templateHandle: agreement.templateHandle,
    offerArchetype: agreement.offerArchetype,
    templateVersion: agreement.templateVersion,
    acceptedAt: agreement.acceptedAt?.toISOString() || null,
    acceptedTemplateVersion: agreement.acceptedTemplateVersion,
    acceptedTemplateHash: agreement.acceptedTemplateHash,
    acceptedLicenseName: agreement.acceptedLicenseName,
    acceptedDeliveryPackage: agreement.acceptedDeliveryPackage,
    acceptedSnapshotMatch: agreement.acceptedSnapshotMatch,
    stemsIncludedInOrder: agreement.stemsIncludedInOrder,
    buyerEmail: agreement.buyerEmail,
    buyerIp: agreement.buyerIp,
    userAgent: agreement.userAgent,
    purchasedAt: agreement.purchasedAt.toISOString(),
    pdfStatus: agreement.pdfStatus,
    pdfHash: agreement.pdfHash,
  };
}

function sanitizeOrder(order: OrderWithRelations) {
  return {
    id: order.id,
    shopifyOrderId: order.shopifyOrderId,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    browserIp: order.browserIp,
    userAgent: order.userAgent,
    acceptLanguage: order.acceptLanguage,
    deliveryAccess: order.deliveryAccess
      ? {
          customerEmail: order.deliveryAccess.customerEmail,
          customerName: order.deliveryAccess.customerName,
          deliveryEmailStatus: order.deliveryAccess.deliveryEmailStatus,
          deliveryEmailSentAt:
            order.deliveryAccess.deliveryEmailSentAt?.toISOString() || null,
          deliveryEmailRecipient: order.deliveryAccess.deliveryEmailRecipient,
          deliveryEmailConfirmedStatus:
            order.deliveryAccess.deliveryEmailConfirmedStatus,
          deliveryEmailConfirmedAt:
            order.deliveryAccess.deliveryEmailConfirmedAt?.toISOString() || null,
          deliveryEmailConfirmedError:
            order.deliveryAccess.deliveryEmailConfirmedError,
          deliveryEmailLastEvent: order.deliveryAccess.deliveryEmailLastEvent,
          deliveryEmailLastEventAt:
            order.deliveryAccess.deliveryEmailLastEventAt?.toISOString() || null,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      shopifyLineId: item.shopifyLineId,
      productId: item.productId,
      variantId: item.variantId,
      beatTitle: item.beatTitle,
      licenseName: item.licenseName,
      stemsIncludedInOrder: item.stemsIncludedInOrder,
      downloadCount: item.downloadCount,
      createdAt: item.createdAt.toISOString(),
      executedAgreement: sanitizeExecutedAgreement(item.executedAgreement),
    })),
  };
}

async function findMatchingOrders(
  shop: string,
  customerEmail: string | null,
  ordersRequested: string[],
) {
  const normalizedShop = normalizeShopDomain(shop);
  const matchedOrderIds = new Set<string>();

  if (customerEmail) {
    const matchingDeliveryAccess = await prisma.deliveryAccess.findMany({
      where: {
        shop: normalizedShop,
        customerEmail,
      },
      select: {
        orderId: true,
      },
    });

    for (const access of matchingDeliveryAccess) {
      matchedOrderIds.add(access.orderId);
    }
  }

  const whereClauses = [
    ordersRequested.length > 0
      ? { shopifyOrderId: { in: ordersRequested } }
      : null,
    matchedOrderIds.size > 0 ? { id: { in: Array.from(matchedOrderIds) } } : null,
  ].filter(Boolean) as Array<Record<string, unknown>>;

  if (whereClauses.length === 0) {
    return [] as OrderWithRelations[];
  }

  return prisma.order.findMany({
    where: {
      shop: normalizedShop,
      OR: whereClauses,
    },
    include: {
      deliveryAccess: true,
      items: {
        include: {
          executedAgreement: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function recordPrivacyDataRequest(
  shop: string,
  payload: ShopifyDataRequestPayload,
) {
  const normalizedShop = normalizeShopDomain(shop);
  const customerEmail = normalizeOptionalString(payload.customer?.email);
  const ordersRequested = parseOrdersRequested(payload);
  const shopifyDataRequestId = getShopifyDataRequestId(payload);
  const matchingOrders = await findMatchingOrders(
    normalizedShop,
    customerEmail,
    ordersRequested,
  );

  const exportPayload = {
    schema: "producer_launchpad.privacy_data_request.v1",
    generatedAt: new Date().toISOString(),
    request: {
      shop: normalizedShop,
      shopifyDataRequestId,
      shopifyCustomerId: normalizeOptionalString(payload.customer?.id),
      customerEmail,
      ordersRequested,
    },
    matchingSummary: {
      orderCount: matchingOrders.length,
      deliveryRecordCount: matchingOrders.filter((order) => order.deliveryAccess)
        .length,
      executedAgreementCount: matchingOrders.reduce(
        (total, order) =>
          total +
          order.items.filter((item) => Boolean(item.executedAgreement)).length,
        0,
      ),
    },
    orders: matchingOrders.map(sanitizeOrder),
  };

  const privacyRequest = await prisma.privacyDataRequest.upsert({
    where: {
      shop_shopifyDataRequestId: {
        shop: normalizedShop,
        shopifyDataRequestId,
      },
    },
    create: {
      shop: normalizedShop,
      shopifyDataRequestId,
      shopifyCustomerId: normalizeOptionalString(payload.customer?.id),
      customerEmail,
      ordersRequestedJson: JSON.stringify(ordersRequested),
      requestPayloadJson: JSON.stringify(payload),
      exportJson: JSON.stringify(exportPayload, null, 2),
      status: "pending",
    },
    update: {
      shopifyCustomerId: normalizeOptionalString(payload.customer?.id),
      customerEmail,
      ordersRequestedJson: JSON.stringify(ordersRequested),
      requestPayloadJson: JSON.stringify(payload),
      exportJson: JSON.stringify(exportPayload, null, 2),
      status: "pending",
      fulfilledAt: null,
    },
  });

  return {
    privacyRequest,
    exportPayload,
    matchingOrders,
  };
}

export async function markPrivacyDataRequestFulfilled(
  id: string,
  shop: string,
): Promise<PrivacyDataRequest> {
  return prisma.privacyDataRequest.update({
    where: { id },
    data: {
      shop: normalizeShopDomain(shop),
      status: "fulfilled",
      fulfilledAt: new Date(),
    },
  });
}

export async function purgeFulfilledPrivacyDataRequests(
  shop: string,
  retentionDays = 90,
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  return prisma.privacyDataRequest.deleteMany({
    where: {
      shop: normalizeShopDomain(shop),
      status: "fulfilled",
      fulfilledAt: {
        lt: cutoff,
      },
    },
  });
}
