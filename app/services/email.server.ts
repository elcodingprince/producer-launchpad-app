import { ResendEmailProvider } from "~/services/emailProviders/resend.server";
import type { DeliveryReadyEmailItem } from "~/emails/DeliveryReadyEmail";

export interface SendDeliveryEmailInput {
  to: string;
  portalUrl: string;
  storeName: string;
  brandName?: string;
  customerName?: string | null;
  orderNumber?: string | null;
  itemSummary?: string | null;
  items?: DeliveryReadyEmailItem[] | null;
  supportEmail?: string | null;
  logoUrl?: string | null;
}

export interface SendDeliveryEmailResult {
  provider: "resend";
  messageId: string | null;
}

export interface DeliveryEmailConfigSummary {
  provider: "resend";
  status: "configured" | "needs_setup";
  from: string | null;
  replyTo: string | null;
  brandName: string;
  trackingEnabled: boolean;
}

function getEnv(name: "RESEND_API_KEY" | "DELIVERY_EMAIL_FROM") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getOptionalEnv(
  name: "DELIVERY_EMAIL_REPLY_TO" | "DELIVERY_EMAIL_BRAND_NAME",
) {
  return process.env[name] || null;
}

export function isResendWebhookTrackingEnabled() {
  return process.env.RESEND_WEBHOOKS_ENABLED === "true";
}

export function getDeliveryEmailConfigSummary(): DeliveryEmailConfigSummary {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.DELIVERY_EMAIL_FROM?.trim() || null;
  const replyTo = process.env.DELIVERY_EMAIL_REPLY_TO?.trim() || null;
  const brandName =
    process.env.DELIVERY_EMAIL_BRAND_NAME?.trim() || "Producer Launchpad";

  return {
    provider: "resend",
    status: apiKey && from ? "configured" : "needs_setup",
    from,
    replyTo,
    brandName,
    trackingEnabled: isResendWebhookTrackingEnabled(),
  };
}

export function getResendWebhookSecret() {
  const value = process.env.RESEND_WEBHOOK_SECRET;

  if (!value) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }

  return value;
}

function getEmailProvider() {
  return new ResendEmailProvider(getEnv("RESEND_API_KEY"));
}

export async function sendDeliveryEmail(
  input: SendDeliveryEmailInput,
): Promise<SendDeliveryEmailResult> {
  const provider = getEmailProvider();
  const brandName =
    input.brandName ||
    getOptionalEnv("DELIVERY_EMAIL_BRAND_NAME") ||
    "Producer Launchpad";

  return provider.sendDeliveryEmail({
    to: input.to,
    from: getEnv("DELIVERY_EMAIL_FROM"),
    replyTo: getOptionalEnv("DELIVERY_EMAIL_REPLY_TO"),
    subject: `Your files are ready from ${input.storeName}`,
    brandName,
    storeName: input.storeName,
    customerName: input.customerName,
    portalUrl: input.portalUrl,
    orderNumber: input.orderNumber,
    itemSummary: input.itemSummary,
    items: input.items,
    supportEmail: input.supportEmail,
    logoUrl: input.logoUrl,
  });
}
