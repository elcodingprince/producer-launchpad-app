import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import crypto from "crypto";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic, session, admin } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response("Unhandled webhook", { status: 200 });
  }

  const orderId = payload.id.toString();
  const orderNumber = payload.order_number?.toString() || orderId;
  const customerEmail = payload.contact_email || payload.email || "";
  const customerName = payload.customer?.first_name 
    ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim() 
    : "Producer";

  // Double check if we already processed it
  const existingOrder = await prisma.order.findUnique({
    where: { shopifyOrderId: orderId }
  });

  if (existingOrder) {
    return new Response("Already processed", { status: 200 }); // Prevent duplicates safely
  }

  // Create highly secure token
  const token = `dl_${crypto.randomBytes(16).toString("hex")}`;

  try {
    const orderItems = [];

    // Filter line items that might be beats (in a real app, you'd check if they have the specific product type or are in your app's DB)
    // Here we'll just parse all items for the demo since it's a dedicated beat store
    for (const item of payload.line_items) {
      if (item.product_id && item.variant_id) {
        orderItems.push({
          shopifyLineId: item.id.toString(),
          productId: item.product_id.toString(),
          variantId: item.variant_id.toString(),
          beatTitle: item.title,
          licenseName: item.variant_title || "Standard License", // The variant title is the License Name from our setup
        });
      }
    }

    if (orderItems.length === 0) {
      return new Response("No digital beats found in order", { status: 200 });
    }

    // Save order in our DB
    const newOrder = await prisma.order.create({
      data: {
        shop,
        shopifyOrderId: orderId,
        orderNumber,
        customerEmail,
        customerName,
        downloadToken: token,
        items: {
          create: orderItems
        }
      }
    });

    console.log(`[Webhook] Created automated delivery portal for Order #${orderNumber}`);

    // Reaching back out to Shopify to save this token on the order metafield
    // It requires an Admin API connection. We use the offline session for the shop.
    if (admin) {
      const portalUrl = `https://${process.env.APP_URL || process.env.HOST}/downloads/${token}`;
      
      const metafieldResponse = await admin.graphql(
        `#graphql
        mutation createOrderMetafield($input: MetafieldsSetInput!) {
          metafieldsSet(metafields: [$input]) {
            metafields { id value }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              ownerId: `gid://shopify/Order/${orderId}`,
              namespace: "producer_launchpad",
              key: "download_url",
              type: "url",
              value: portalUrl,
            }
          }
        }
      );
      
      const metaResponseJson = await metafieldResponse.json();
      if (metaResponseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("Failed to set order metafield:", metaResponseJson.data.metafieldsSet.userErrors);
      } else {
        console.log(`[Webhook] Successfully stamped download URL onto Shopify Order #${orderNumber}`);
      }
    }

    return new Response("Processing complete", { status: 200 });

  } catch (error) {
    console.error("Error processing order webhook:", error);
    return new Response("Internal error", { status: 500 });
  }
};
