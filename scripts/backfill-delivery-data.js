/* eslint-env node */

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeShopifyResourceId(id) {
  if (!id) return "";
  const match = String(id).match(/\/(\d+)$/);
  return match ? match[1] : String(id);
}

async function fetchOrderFromShopify(shop, accessToken, shopifyOrderId) {
  const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: `
        query BackfillOrder($id: ID!) {
          order(id: $id) {
            id
            email
            lineItems(first: 100) {
              nodes {
                id
                title
                variant {
                  id
                  title
                }
                product {
                  id
                }
              }
            }
          }
        }
      `,
      variables: {
        id: `gid://shopify/Order/${shopifyOrderId}`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify GraphQL failed with ${response.status}`);
  }

  const payload = await response.json();
  const errors = payload.errors || payload.data?.order?.userErrors;

  if (errors && errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return payload.data?.order || null;
}

async function main() {
  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    select: {
      shop: true,
      accessToken: true,
    },
  });

  const accessTokenByShop = new Map(
    sessions.map((session) => [session.shop, session.accessToken]),
  );

  const orders = await prisma.order.findMany({
    include: {
      items: true,
      deliveryAccess: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let backfilledAccess = 0;
  let backfilledItems = 0;

  for (const order of orders) {
    const accessToken = accessTokenByShop.get(order.shop);

    if (!accessToken) {
      console.warn(`Skipping ${order.orderNumber}: no offline session for ${order.shop}`);
      continue;
    }

    if (order.deliveryAccess && order.items.length > 0) {
      continue;
    }

    const remoteOrder = await fetchOrderFromShopify(
      order.shop,
      accessToken,
      order.shopifyOrderId,
    );

    if (!remoteOrder) {
      console.warn(`Skipping ${order.orderNumber}: order not found in Shopify`);
      continue;
    }

    const customerEmail =
      remoteOrder.email ||
      order.deliveryAccess?.customerEmail ||
      "";

    if (!order.deliveryAccess) {
      await prisma.deliveryAccess.create({
        data: {
          orderId: order.id,
          shop: order.shop,
          customerEmail,
          customerName: null,
          downloadToken: `dl_${crypto.randomBytes(16).toString("hex")}`,
          deliveryEmailStatus: "backfilled",
        },
      });
      backfilledAccess += 1;
    }

    if (order.items.length === 0) {
      const items = remoteOrder.lineItems?.nodes || [];

      if (items.length > 0) {
        await prisma.orderItem.createMany({
          data: items
            .filter((item) => item.product?.id && item.variant?.id)
            .map((item) => ({
              orderId: order.id,
              shopifyLineId: normalizeShopifyResourceId(item.id),
              productId: normalizeShopifyResourceId(item.product.id),
              variantId: normalizeShopifyResourceId(item.variant.id),
              beatTitle: item.title,
              licenseName: item.variant?.title || "Standard License",
            })),
        });
        backfilledItems += items.length;
      }
    }
  }

  console.log(
    `Backfill complete. DeliveryAccess restored: ${backfilledAccess}, OrderItems restored: ${backfilledItems}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
