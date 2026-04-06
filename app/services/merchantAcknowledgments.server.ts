import prisma from "~/db.server";

export const MERCHANT_ACKNOWLEDGMENT_KEYS = {
  uploadLicensePublishing: {
    key: "upload_license_publishing",
    version: "2026-04-05",
  },
  customLicenseTemplateCreation: {
    key: "custom_license_template_creation",
    version: "2026-04-05",
  },
} as const;

type MerchantAcknowledgmentKey =
  (typeof MERCHANT_ACKNOWLEDGMENT_KEYS)[keyof typeof MERCHANT_ACKNOWLEDGMENT_KEYS];

export function normalizeSessionUserId(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

export async function hasMerchantAcknowledged(
  shop: string,
  acknowledgment: MerchantAcknowledgmentKey,
) {
  const record = await prisma.merchantAcknowledgment.findUnique({
    where: {
      shop_acknowledgmentKey_version: {
        shop,
        acknowledgmentKey: acknowledgment.key,
        version: acknowledgment.version,
      },
    },
    select: { id: true },
  });

  return Boolean(record);
}

export async function acceptMerchantAcknowledgment(options: {
  shop: string;
  acknowledgment: MerchantAcknowledgmentKey;
  acceptedByUserId?: bigint | null;
  acceptedByEmail?: string | null;
}) {
  const { shop, acknowledgment, acceptedByUserId, acceptedByEmail } = options;

  return prisma.merchantAcknowledgment.upsert({
    where: {
      shop_acknowledgmentKey_version: {
        shop,
        acknowledgmentKey: acknowledgment.key,
        version: acknowledgment.version,
      },
    },
    update: {
      acceptedAt: new Date(),
      acceptedByUserId: acceptedByUserId ?? null,
      acceptedByEmail: acceptedByEmail ?? null,
    },
    create: {
      shop,
      acknowledgmentKey: acknowledgment.key,
      version: acknowledgment.version,
      acceptedAt: new Date(),
      acceptedByUserId: acceptedByUserId ?? null,
      acceptedByEmail: acceptedByEmail ?? null,
    },
  });
}
