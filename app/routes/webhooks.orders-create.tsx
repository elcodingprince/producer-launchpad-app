import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import crypto from "crypto";
import type { OrderItem } from "@prisma/client";
import { sendDeliveryEmail } from "~/services/email.server";
import { buildDownloadPortalUrl, formatStoreName } from "~/services/appUrl.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);

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
          productId: normalizeShopifyResourceId(item.product_id.toString()),
          variantId: normalizeShopifyResourceId(item.variant_id.toString()),
          beatTitle: item.title,
          licenseName: item.variant_title || "Standard License", // The variant title is the License Name from our setup
        });
      }
    }

    if (orderItems.length === 0) {
      return new Response("No digital beats found in order", { status: 200 });
    }

    // Save order in our DB
    const createdOrder = await prisma.order.create({
      data: {
        shop,
        shopifyOrderId: orderId,
        orderNumber,
        items: {
          create: orderItems
        },
        deliveryAccess: {
          create: {
            shop,
            customerEmail,
            customerName,
            downloadToken: token,
          },
        },
      },
      include: {
        items: true,
        deliveryAccess: true,
      },
    });

    if (!customerEmail) {
      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "skipped",
          deliveryEmailError: "Missing customer email",
        },
      });

      console.log(`[Webhook] Skipped delivery email for Order #${orderNumber}: missing customer email`);
      console.log(`[Webhook] Created automated delivery portal for Order #${orderNumber}`);

      return new Response("Processing complete", { status: 200 });
    }

    try {
      const emailResult = await sendDeliveryEmail({
        to: customerEmail,
        portalUrl: buildDownloadPortalUrl(token, request),
        storeName: formatStoreName(shop),
        customerFirstName: payload.customer?.first_name || customerName || null,
        orderNumber,
        itemSummary: createdOrder.items
          .map((item: OrderItem) => `${item.beatTitle} - ${item.licenseName}`)
          .join(", "),
      });

      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "sent",
          deliveryEmailSentAt: new Date(),
          deliveryEmailRecipient: customerEmail,
          deliveryEmailMessageId: emailResult.messageId,
          deliveryEmailError: null,
        },
      });

      console.log(`[Webhook] Sent delivery email for Order #${orderNumber}`);
    } catch (emailError) {
      const message =
        emailError instanceof Error ? emailError.message : "Unknown email delivery error";

      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "failed",
          deliveryEmailRecipient: customerEmail,
          deliveryEmailError: message,
        },
      });

      console.error(`[Webhook] Failed to send delivery email for Order #${orderNumber}:`, emailError);
    }

    console.log(`[Webhook] Created automated delivery portal for Order #${orderNumber}`);

    return new Response("Processing complete", { status: 200 });

  } catch (error) {
    console.error("Error processing order webhook:", error);
    return new Response("Internal error", { status: 500 });
  }
};
