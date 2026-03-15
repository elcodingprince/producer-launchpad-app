import type { ActionFunctionArgs } from "@remix-run/node";
import { Resend } from "resend";
import prisma from "~/db.server";
import {
  getResendWebhookSecret,
  isResendWebhookTrackingEnabled,
} from "~/services/email.server";

const deliveryEmailStatusPriority: Record<string, number> = {
  pending: 1,
  delayed: 2,
  failed: 3,
  bounced: 4,
  complained: 4,
  delivered: 5,
};

function parseWebhookDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getHeader(request: Request, name: string) {
  return request.headers.get(name) || "";
}

function shouldPromoteDeliveryStatus(
  currentStatus: string | null,
  nextStatus: string,
) {
  const currentPriority = currentStatus
    ? deliveryEmailStatusPriority[currentStatus] || 0
    : 0;
  const nextPriority = deliveryEmailStatusPriority[nextStatus] || 0;

  return nextPriority > currentPriority;
}

function getFailedReason(
  event: Extract<ReturnType<Resend["webhooks"]["verify"]>, { type: "email.failed" }>,
) {
  return event.data.failed?.reason || "Resend reported an email failure";
}

function getBounceMessage(
  event: Extract<ReturnType<Resend["webhooks"]["verify"]>, { type: "email.bounced" }>,
) {
  return event.data.bounce?.message || "Resend reported an email bounce";
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!isResendWebhookTrackingEnabled()) {
    return new Response("Webhook tracking disabled", { status: 202 });
  }

  const payload = await request.text();

  const resendId = getHeader(request, "svix-id");
  const resendTimestamp = getHeader(request, "svix-timestamp");
  const resendSignature = getHeader(request, "svix-signature");

  if (!resendId || !resendTimestamp || !resendSignature) {
    return new Response("Missing Resend webhook headers", { status: 400 });
  }

  let event: ReturnType<Resend["webhooks"]["verify"]>;

  try {
    event = new Resend().webhooks.verify({
      payload,
      webhookSecret: getResendWebhookSecret(),
      headers: {
        id: resendId,
        timestamp: resendTimestamp,
        signature: resendSignature,
      },
    });
  } catch (error) {
    console.error("[Resend webhook] Signature verification failed:", error);
    return new Response("Invalid signature", { status: 401 });
  }

  const emailId = "data" in event && event.data && "email_id" in event.data
    ? event.data.email_id
    : null;

  if (!emailId) {
    return new Response("Ignored event", { status: 200 });
  }

  const eventAt = parseWebhookDate(event.created_at);
  const matchingAccess = await prisma.deliveryAccess.findFirst({
    where: { deliveryEmailMessageId: emailId },
    select: {
      id: true,
      deliveryEmailConfirmedStatus: true,
    },
  });

  if (!matchingAccess) {
    return new Response("No matching delivery access record", { status: 200 });
  }

  const updateBase = {
    deliveryEmailLastEvent: event.type,
    deliveryEmailLastEventAt: eventAt,
  };

  switch (event.type) {
    case "email.sent": {
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: updateBase,
      });
      break;
    }

    case "email.delivered": {
      const nextStatus = "delivered";
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: shouldPromoteDeliveryStatus(
          matchingAccess.deliveryEmailConfirmedStatus,
          nextStatus,
        )
          ? {
              ...updateBase,
              deliveryEmailConfirmedStatus: nextStatus,
              deliveryEmailConfirmedAt: eventAt,
              deliveryEmailConfirmedError: null,
            }
          : updateBase,
      });
      break;
    }

    case "email.delivery_delayed": {
      const nextStatus = "delayed";
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: shouldPromoteDeliveryStatus(
          matchingAccess.deliveryEmailConfirmedStatus,
          nextStatus,
        )
          ? {
              ...updateBase,
              deliveryEmailConfirmedStatus: nextStatus,
            }
          : updateBase,
      });
      break;
    }

    case "email.failed": {
      const nextStatus = "failed";
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: shouldPromoteDeliveryStatus(
          matchingAccess.deliveryEmailConfirmedStatus,
          nextStatus,
        )
          ? {
              ...updateBase,
              deliveryEmailConfirmedStatus: nextStatus,
              deliveryEmailConfirmedError: getFailedReason(event),
            }
          : updateBase,
      });
      break;
    }

    case "email.bounced": {
      const nextStatus = "bounced";
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: shouldPromoteDeliveryStatus(
          matchingAccess.deliveryEmailConfirmedStatus,
          nextStatus,
        )
          ? {
              ...updateBase,
              deliveryEmailConfirmedStatus: nextStatus,
              deliveryEmailConfirmedError: getBounceMessage(event),
            }
          : updateBase,
      });
      break;
    }

    case "email.complained": {
      const nextStatus = "complained";
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: shouldPromoteDeliveryStatus(
          matchingAccess.deliveryEmailConfirmedStatus,
          nextStatus,
        )
          ? {
              ...updateBase,
              deliveryEmailConfirmedStatus: nextStatus,
            }
          : updateBase,
      });
      break;
    }

    default: {
      await prisma.deliveryAccess.update({
        where: { id: matchingAccess.id },
        data: updateBase,
      });
    }
  }

  return new Response("ok", { status: 200 });
};
