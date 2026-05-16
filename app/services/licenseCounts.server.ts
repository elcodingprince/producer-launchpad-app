import { Prisma } from "@prisma/client";
import prisma from "~/db.server";
import { createShopifyClient } from "./shopify";

export const LICENSE_COUNT_WEBHOOK_TOPIC = "orders/paid";
export const LICENSE_COUNT_METAFIELD_WINDOW_DAYS = 7;

const LICENSE_COUNT_METAFIELD = {
  namespace: "custom",
  key: "license_count",
  type: "number_integer",
};

type AdminClient = {
  graphql: (query: string, options?: Record<string, any>) => Promise<Response>;
};

export type LicenseCountLineItem = {
  shopifyLineItemId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  quantity: number;
};

export type PaidOrderLicenseLineItemsResult = {
  lineItems: LicenseCountLineItem[];
  soldAt: Date;
};

type LicenseCountRecordState =
  | "processed"
  | "already_processed"
  | "already_synced";

export type LicenseCountRecordResult = {
  state: LicenseCountRecordState;
  affectedProductIds: string[];
};

function normalizeShopifyResourceId(value: unknown) {
  const id = String(value || "").trim();
  if (!id) return "";
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function toShopifyGid(type: string, value: string) {
  return value.startsWith("gid://shopify/")
    ? value
    : `gid://shopify/${type}/${normalizeShopifyResourceId(value)}`;
}

function parseQuantity(value: unknown) {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity);
}

function parseShopifyDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLicenseCountWindowStart(now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - LICENSE_COUNT_METAFIELD_WINDOW_DAYS);
  return start;
}

function parseProductIdsJson(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((id) => normalizeShopifyResourceId(id))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function groupLineItems(lineItems: LicenseCountLineItem[]) {
  const productQuantityById = new Map<string, number>();
  const variantQuantityById = new Map<
    string,
    { productId: string; quantity: number }
  >();

  for (const item of lineItems) {
    productQuantityById.set(
      item.shopifyProductId,
      (productQuantityById.get(item.shopifyProductId) || 0) + item.quantity,
    );

    const existing = variantQuantityById.get(item.shopifyVariantId);
    variantQuantityById.set(item.shopifyVariantId, {
      productId: item.shopifyProductId,
      quantity: (existing?.quantity || 0) + item.quantity,
    });
  }

  return { productQuantityById, variantQuantityById };
}

export async function fetchPaidOrderLicenseLineItems({
  shopifyOrderId,
  admin,
}: {
  shopifyOrderId: string;
  admin: AdminClient;
}): Promise<PaidOrderLicenseLineItemsResult> {
  const lineItems: LicenseCountLineItem[] = [];
  let cursor: string | null = null;
  let soldAt: Date | null = null;

  do {
    const response = await admin.graphql(
      `#graphql
        query PaidOrderLicenseLineItems($id: ID!, $cursor: String) {
          order(id: $id) {
            processedAt
            createdAt
            lineItems(first: 250, after: $cursor) {
              nodes {
                id
                quantity
                variant {
                  id
                  licenseReference: metafield(namespace: "custom", key: "license_reference") {
                    id
                    value
                  }
                  product {
                    id
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      {
        variables: {
          id: toShopifyGid("Order", shopifyOrderId),
          cursor,
        },
      },
    );

    const payload = (await response.json()) as {
      data?: {
        order?: {
          processedAt?: string | null;
          createdAt?: string | null;
          lineItems?: {
            nodes: Array<{
              id?: string | null;
              quantity?: number | null;
              variant?: {
                id?: string | null;
                licenseReference?: {
                  id?: string | null;
                  value?: string | null;
                } | null;
                product?: {
                  id?: string | null;
                } | null;
              } | null;
            }>;
            pageInfo?: {
              hasNextPage: boolean;
              endCursor?: string | null;
            };
          } | null;
        } | null;
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(
        `Failed to fetch paid order license line items: ${payload.errors
          .map((error) => error.message)
          .join("; ")}`,
      );
    }

    if (!soldAt) {
      soldAt =
        parseShopifyDate(payload.data?.order?.processedAt) ||
        parseShopifyDate(payload.data?.order?.createdAt);
    }

    const nodes = payload.data?.order?.lineItems?.nodes || [];

    for (const node of nodes) {
      if (!node.variant?.licenseReference?.value) continue;

      const shopifyLineItemId = normalizeShopifyResourceId(node.id);
      const shopifyVariantId = normalizeShopifyResourceId(node.variant.id);
      const shopifyProductId = normalizeShopifyResourceId(
        node.variant.product?.id,
      );
      const quantity = parseQuantity(node.quantity);

      if (
        !shopifyLineItemId ||
        !shopifyProductId ||
        !shopifyVariantId ||
        quantity <= 0
      ) {
        continue;
      }

      lineItems.push({
        shopifyLineItemId,
        shopifyProductId,
        shopifyVariantId,
        quantity,
      });
    }

    const pageInfo = payload.data?.order?.lineItems?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor || null : null;
  } while (cursor);

  return {
    lineItems,
    soldAt: soldAt || new Date(),
  };
}

export async function recordPaidOrderLicenseCounts({
  shop,
  shopifyOrderId,
  lineItems,
  soldAt,
}: {
  shop: string;
  shopifyOrderId: string;
  lineItems: LicenseCountLineItem[];
  soldAt: Date;
}): Promise<LicenseCountRecordResult> {
  const normalizedOrderId = normalizeShopifyResourceId(shopifyOrderId);
  const normalizedLineItems = lineItems
    .map((item) => ({
      ...item,
      shopifyLineItemId: normalizeShopifyResourceId(item.shopifyLineItemId),
      shopifyProductId: normalizeShopifyResourceId(item.shopifyProductId),
      shopifyVariantId: normalizeShopifyResourceId(item.shopifyVariantId),
      quantity: parseQuantity(item.quantity),
    }))
    .filter(
      (item) =>
        item.shopifyLineItemId &&
        item.shopifyProductId &&
        item.shopifyVariantId &&
        item.quantity > 0,
    );
  const affectedProductIds = Array.from(
    new Set(normalizedLineItems.map((item) => item.shopifyProductId)),
  );

  if (normalizedLineItems.length === 0) {
    return {
      state: "processed",
      affectedProductIds,
    };
  }

  const saleEventData = normalizedLineItems.map((item) => ({
    shop,
    topic: LICENSE_COUNT_WEBHOOK_TOPIC,
    shopifyOrderId: normalizedOrderId,
    shopifyLineItemId: item.shopifyLineItemId,
    shopifyProductId: item.shopifyProductId,
    shopifyVariantId: item.shopifyVariantId,
    quantity: item.quantity,
    soldAt,
  }));

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.processedOrder.create({
        data: {
          shop,
          shopifyOrderId: normalizedOrderId,
          topic: LICENSE_COUNT_WEBHOOK_TOPIC,
          productIdsJson: JSON.stringify(affectedProductIds),
        },
      });

      const { productQuantityById, variantQuantityById } =
        groupLineItems(normalizedLineItems);

      await tx.licenseSaleEvent.createMany({
        data: saleEventData,
        skipDuplicates: true,
      });

      for (const [shopifyProductId, quantity] of productQuantityById) {
        await tx.productLicenseCount.upsert({
          where: {
            shop_shopifyProductId: {
              shop,
              shopifyProductId,
            },
          },
          create: {
            shop,
            shopifyProductId,
            count: quantity,
          },
          update: {
            count: {
              increment: quantity,
            },
          },
        });
      }

      for (const [shopifyVariantId, variantCount] of variantQuantityById) {
        await tx.variantLicenseCount.upsert({
          where: {
            shop_shopifyVariantId: {
              shop,
              shopifyVariantId,
            },
          },
          create: {
            shop,
            shopifyProductId: variantCount.productId,
            shopifyVariantId,
            count: variantCount.quantity,
          },
          update: {
            shopifyProductId: variantCount.productId,
            count: {
              increment: variantCount.quantity,
            },
          },
        });
      }
    });

    return {
      state: "processed",
      affectedProductIds,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await prisma.processedOrder.findUnique({
      where: {
        shop_shopifyOrderId_topic: {
          shop,
          shopifyOrderId: normalizedOrderId,
          topic: LICENSE_COUNT_WEBHOOK_TOPIC,
        },
      },
    });

    if (existing) {
      await prisma.licenseSaleEvent.createMany({
        data: saleEventData,
        skipDuplicates: true,
      });
    }

    return {
      state: existing?.metafieldsSyncedAt
        ? "already_synced"
        : "already_processed",
      affectedProductIds: parseProductIdsJson(existing?.productIdsJson),
    };
  }
}

export async function syncProductLicenseCountMetafields({
  shop,
  productIds,
  admin,
}: {
  shop: string;
  productIds: string[];
  admin: AdminClient;
}) {
  const normalizedProductIds = Array.from(
    new Set(productIds.map((id) => normalizeShopifyResourceId(id))),
  ).filter(Boolean);

  if (normalizedProductIds.length === 0) return;

  const windowStart = getLicenseCountWindowStart();
  const counts = await prisma.licenseSaleEvent.groupBy({
    by: ["shopifyProductId"],
    where: {
      shop,
      shopifyProductId: {
        in: normalizedProductIds,
      },
      soldAt: {
        gte: windowStart,
      },
    },
    _sum: {
      quantity: true,
    },
  });
  const countByProductId = new Map(
    counts.map((count) => [
      count.shopifyProductId,
      count._sum.quantity || 0,
    ]),
  );
  const client = createShopifyClient({ shop }, admin);
  const metafields = normalizedProductIds.map((productId) => ({
    ownerId: toShopifyGid("Product", productId),
    namespace: LICENSE_COUNT_METAFIELD.namespace,
    key: LICENSE_COUNT_METAFIELD.key,
    type: LICENSE_COUNT_METAFIELD.type,
    value: String(countByProductId.get(productId) || 0),
  }));

  for (let index = 0; index < metafields.length; index += 25) {
    await client.setMetafields(metafields.slice(index, index + 25));
  }
}

export async function markPaidOrderLicenseMetafieldsSynced({
  shop,
  shopifyOrderId,
}: {
  shop: string;
  shopifyOrderId: string;
}) {
  await prisma.processedOrder.update({
    where: {
      shop_shopifyOrderId_topic: {
        shop,
        shopifyOrderId: normalizeShopifyResourceId(shopifyOrderId),
        topic: LICENSE_COUNT_WEBHOOK_TOPIC,
      },
    },
    data: {
      metafieldsSyncedAt: new Date(),
    },
  });
}
