import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "~/shopify.server";
import prisma from "~/db.server";
import crypto from "crypto";
import type { OrderItem } from "@prisma/client";
import {
  isResendWebhookTrackingEnabled,
  sendDeliveryEmail,
} from "~/services/email.server";
import { getDeliveredFormatLabelsForOrder } from "~/services/deliveryPackages";
import { buildExecutedAgreementSnapshot } from "~/services/executedAgreements.server";
import {
  buildDownloadPortalUrl,
  formatStoreName,
} from "~/services/appUrl.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function buildCustomerName(payload: any) {
  const nameCandidates = [
    payload.billing_address,
    payload.shipping_address,
    payload.customer,
    payload.default_address,
  ];

  for (const candidate of nameCandidates) {
    if (!candidate) continue;

    const firstName = String(candidate.first_name || "").trim();
    const lastName = String(candidate.last_name || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (fullName) {
      return fullName;
    }
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function getCheckoutAuditFields(payload: any) {
  return {
    browserIp:
      normalizeOptionalString(payload.browser_ip) ||
      normalizeOptionalString(payload.client_details?.browser_ip),
    userAgent: normalizeOptionalString(payload.client_details?.user_agent),
    acceptLanguage: normalizeOptionalString(
      payload.client_details?.accept_language,
    ),
  };
}

function normalizeStemsAddonLabel(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeStemsAddonLineItem(lineItem: {
  name?: string | null;
  variant?: {
    product?: {
      handle?: string | null;
      title?: string | null;
      tags?: string[] | null;
    } | null;
  } | null;
  lineItemGroup?: {
    title?: string | null;
  } | null;
}) {
  if (!lineItem.lineItemGroup) return false;

  const productHandle = String(
    lineItem.variant?.product?.handle || "",
  ).toLowerCase();
  const tags = (lineItem.variant?.product?.tags || []).map((tag) =>
    String(tag).toLowerCase(),
  );
  const titleCandidates = [
    lineItem.name,
    lineItem.lineItemGroup?.title,
    lineItem.variant?.product?.title,
  ]
    .map((value) => normalizeStemsAddonLabel(value))
    .filter(Boolean);

  return (
    productHandle === "stems-add-on" ||
    tags.includes("addon-only") ||
    titleCandidates.some(
      (value) => value === "stems add on" || value === "stems addon",
    )
  );
}

async function fetchOrderLineItemComposition(shop: string, orderId: string) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `#graphql
        query OrderLineItemComposition($id: ID!) {
          order(id: $id) {
            lineItems(first: 250) {
              nodes {
                id
                name
                variant {
                  id
                  product {
                    handle
                    title
                    tags
                  }
                }
                lineItemGroup {
                  title
                  variantId
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          id: `gid://shopify/Order/${orderId}`,
        },
      },
    );

    const payload = (await response.json()) as {
      data?: {
        order?: {
          lineItems?: {
            nodes: Array<{
              id: string;
              name?: string | null;
              variant?: {
                id?: string | null;
                product?: {
                  handle?: string | null;
                  title?: string | null;
                  tags?: string[] | null;
                } | null;
              } | null;
              lineItemGroup?: {
                title?: string | null;
                variantId?: string | null;
              } | null;
            }>;
          } | null;
        } | null;
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const nodes = payload.data?.order?.lineItems?.nodes || [];
    const stemsAddonLineItemIds = new Set<string>();
    const parentVariantIdsWithStems = new Set<string>();

    for (const lineItem of nodes) {
      if (!looksLikeStemsAddonLineItem(lineItem)) continue;

      const normalizedLineItemId = normalizeShopifyResourceId(lineItem.id);
      const normalizedParentVariantId = normalizeShopifyResourceId(
        String(lineItem.lineItemGroup?.variantId || ""),
      );

      if (normalizedLineItemId) {
        stemsAddonLineItemIds.add(normalizedLineItemId);
      }

      if (normalizedParentVariantId) {
        parentVariantIdsWithStems.add(normalizedParentVariantId);
      }
    }

    return {
      stemsAddonLineItemIds,
      parentVariantIdsWithStems,
    };
  } catch (error) {
    console.error(
      `[Webhook] Failed to inspect nested line items for order ${orderId}:`,
      error,
    );

    return {
      stemsAddonLineItemIds: new Set<string>(),
      parentVariantIdsWithStems: new Set<string>(),
    };
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const webhookTrackingEnabled = isResendWebhookTrackingEnabled();

  const orderId = payload.id.toString();
  const orderNumber = payload.order_number?.toString() || orderId;
  const customerEmail = payload.contact_email || payload.email || "";
  const customerName = buildCustomerName(payload);
  const checkoutAuditFields = getCheckoutAuditFields(payload);

  // Double check if we already processed it
  const existingOrder = await prisma.order.findUnique({
    where: { shopifyOrderId: orderId },
  });

  if (existingOrder) {
    return new Response("Already processed", { status: 200 }); // Prevent duplicates safely
  }

  // Create highly secure token
  const token = `dl_${crypto.randomBytes(16).toString("hex")}`;

  try {
    const { stemsAddonLineItemIds, parentVariantIdsWithStems } =
      await fetchOrderLineItemComposition(shop, orderId);
    const orderItems = [];

    // Filter line items that might be beats (in a real app, you'd check if they have the specific product type or are in your app's DB)
    // Here we'll just parse all items for the demo since it's a dedicated beat store
    for (const item of payload.line_items) {
      if (item.product_id && item.variant_id) {
        const normalizedLineItemId = normalizeShopifyResourceId(
          item.id.toString(),
        );
        if (stemsAddonLineItemIds.has(normalizedLineItemId)) {
          continue;
        }

        const normalizedVariantId = normalizeShopifyResourceId(
          item.variant_id.toString(),
        );
        orderItems.push({
          shopifyLineId: item.id.toString(),
          productId: normalizeShopifyResourceId(item.product_id.toString()),
          variantId: normalizedVariantId,
          beatTitle: item.title,
          licenseName: item.variant_title || "Standard License", // The variant title is the License Name from our setup
          stemsIncludedInOrder:
            parentVariantIdsWithStems.has(normalizedVariantId),
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
        browserIp: checkoutAuditFields.browserIp,
        userAgent: checkoutAuditFields.userAgent,
        acceptLanguage: checkoutAuditFields.acceptLanguage,
        items: {
          create: orderItems,
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

    const executedAgreementByOrderItemId = new Map<
      string,
      {
        stemsIncludedInOrder: boolean;
        resolvedLicenseJson: string;
      }
    >();

    for (const item of createdOrder.items) {
      try {
        const executedAgreement = await buildExecutedAgreementSnapshot({
          shop,
          order: {
            id: createdOrder.id,
            shopifyOrderId: createdOrder.shopifyOrderId,
            orderNumber: createdOrder.orderNumber,
            browserIp: createdOrder.browserIp,
            userAgent: createdOrder.userAgent,
            createdAt: createdOrder.createdAt,
          },
          orderItem: {
            id: item.id,
            shopifyLineId: item.shopifyLineId,
            variantId: item.variantId,
            beatTitle: item.beatTitle,
            licenseName: item.licenseName,
            stemsIncludedInOrder: item.stemsIncludedInOrder,
          },
          customerEmail: customerEmail || null,
          customerName,
        });

        const savedExecutedAgreement = await prisma.executedAgreement.create({
          data: executedAgreement,
        });
        executedAgreementByOrderItemId.set(item.id, {
          stemsIncludedInOrder: savedExecutedAgreement.stemsIncludedInOrder,
          resolvedLicenseJson: savedExecutedAgreement.resolvedLicenseJson,
        });

        if (
          savedExecutedAgreement.stemsIncludedInOrder !==
          item.stemsIncludedInOrder
        ) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              stemsIncludedInOrder: savedExecutedAgreement.stemsIncludedInOrder,
            },
          });
        }
      } catch (snapshotError) {
        console.error(
          `[Webhook] Failed to create executed agreement for order item ${item.id}:`,
          snapshotError,
        );
      }
    }

    if (!customerEmail) {
      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "skipped",
          deliveryEmailError: "Missing customer email",
        },
      });

      console.log(
        `[Webhook] Skipped delivery email for Order #${orderNumber}: missing customer email`,
      );
      console.log(
        `[Webhook] Created automated delivery portal for Order #${orderNumber}`,
      );

      return new Response("Processing complete", { status: 200 });
    }

    try {
      const emailItems = await Promise.all(
        createdOrder.items.map(async (item: OrderItem) => {
          const executedAgreement = executedAgreementByOrderItemId.get(item.id);
          const resolvedLicense = executedAgreement
            ? JSON.parse(executedAgreement.resolvedLicenseJson)
            : null;
          const deliveryFormats = resolvedLicense
            ? getDeliveredFormatLabelsForOrder({
                fileFormats: resolvedLicense.fileFormats,
                stemsPolicy: resolvedLicense.stemsPolicy,
                stemsIncludedInOrder: executedAgreement?.stemsIncludedInOrder,
              })
            : item.stemsIncludedInOrder
              ? ["MP3", "STEMS"]
              : ["MP3"];

          return {
            beatTitle: item.beatTitle,
            licenseName: item.licenseName,
            deliveryFormats,
          };
        }),
      );

      const emailResult = await sendDeliveryEmail({
        to: customerEmail,
        portalUrl: buildDownloadPortalUrl(token, request),
        storeName: formatStoreName(shop),
        customerName,
        orderNumber,
        itemSummary: createdOrder.items
          .map((item: OrderItem) => `${item.beatTitle} - ${item.licenseName}`)
          .join(", "),
        items: emailItems,
      });

      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "sent",
          deliveryEmailSentAt: new Date(),
          deliveryEmailRecipient: customerEmail,
          deliveryEmailMessageId: emailResult.messageId,
          deliveryEmailError: null,
          deliveryEmailConfirmedStatus: webhookTrackingEnabled
            ? "pending"
            : null,
          deliveryEmailConfirmedAt: null,
          deliveryEmailConfirmedError: null,
          deliveryEmailLastEvent: null,
          deliveryEmailLastEventAt: null,
        },
      });

      console.log(`[Webhook] Sent delivery email for Order #${orderNumber}`);
    } catch (emailError) {
      const message =
        emailError instanceof Error
          ? emailError.message
          : "Unknown email delivery error";

      await prisma.deliveryAccess.update({
        where: { orderId: createdOrder.id },
        data: {
          deliveryEmailStatus: "failed",
          deliveryEmailRecipient: customerEmail,
          deliveryEmailError: message,
        },
      });

      console.error(
        `[Webhook] Failed to send delivery email for Order #${orderNumber}:`,
        emailError,
      );
    }

    console.log(
      `[Webhook] Created automated delivery portal for Order #${orderNumber}`,
    );

    return new Response("Processing complete", { status: 200 });
  } catch (error) {
    console.error("Error processing order webhook:", error);
    return new Response("Internal error", { status: 500 });
  }
};
