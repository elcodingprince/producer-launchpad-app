import { ResendEmailProvider } from "~/services/emailProviders/resend.server";

export interface SendDeliveryEmailInput {
  to: string;
  portalUrl: string;
  storeName: string;
  brandName?: string;
  customerFirstName?: string | null;
  orderNumber?: string | null;
  itemSummary?: string | null;
  supportEmail?: string | null;
  logoUrl?: string | null;
}

export interface SendDeliveryEmailResult {
  provider: "resend";
  messageId: string | null;
}

function getEnv(name: "RESEND_API_KEY" | "DELIVERY_EMAIL_FROM") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getOptionalEnv(name: "DELIVERY_EMAIL_REPLY_TO" | "DELIVERY_EMAIL_BRAND_NAME") {
  return process.env[name] || null;
}

function getEmailProvider() {
  return new ResendEmailProvider(getEnv("RESEND_API_KEY"));
}

export async function sendDeliveryEmail(
  input: SendDeliveryEmailInput,
): Promise<SendDeliveryEmailResult> {
  const provider = getEmailProvider();
  const brandName = input.brandName || getOptionalEnv("DELIVERY_EMAIL_BRAND_NAME") || "Producer Launchpad";

  return provider.sendDeliveryEmail({
    to: input.to,
    from: getEnv("DELIVERY_EMAIL_FROM"),
    replyTo: getOptionalEnv("DELIVERY_EMAIL_REPLY_TO"),
    subject: `Your files are ready from ${input.storeName}`,
    brandName,
    storeName: input.storeName,
    customerFirstName: input.customerFirstName,
    portalUrl: input.portalUrl,
    orderNumber: input.orderNumber,
    itemSummary: input.itemSummary,
    supportEmail: input.supportEmail,
    logoUrl: input.logoUrl,
  });
}
