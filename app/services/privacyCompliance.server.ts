import crypto from "node:crypto";
import type {
  ExecutedAgreement,
  Order,
  OrderItem,
  Prisma,
} from "@prisma/client";
import prisma from "~/db.server";
import {
  renderAgreementPreview,
  type AgreementLicenseConfig,
  type AgreementLicensorConfig,
} from "~/services/licenses/agreementRenderer.server";
import { generatePdfFromHtml } from "~/services/pdf/htmlToPdf.server";

// Launch policy: core transaction, delivery, and agreement records remain while
// the merchant actively uses the app so they can support sold-license proof and
// fulfillment history. Time-based cleanup currently applies only to sensitive
// diagnostic metadata and fulfilled privacy-request artifacts.
const PRIVACY_REQUEST_RETENTION_DAYS = 90;
const TELEMETRY_RETENTION_DAYS = 90;
const DELIVERY_EVENT_RETENTION_DAYS = 90;

type ShopifyPrivacyPayload = {
  customer?: {
    id?: string | number | null;
    email?: string | null;
  } | null;
  data_request?: {
    id?: string | number | null;
  } | null;
};

type CustomerIdentifiers = {
  shopifyCustomerId: string | null;
  customerEmail: string | null;
};

type ExecutedAgreementWithOrder = ExecutedAgreement & {
  order: Pick<Order, "orderNumber" | "createdAt">;
  orderItem: Pick<OrderItem, "beatTitle">;
};

function normalizeShopDomain(shop: string) {
  return shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function daysAgo(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

function buildRedactedDownloadToken() {
  return `redacted_${crypto.randomBytes(16).toString("hex")}`;
}

function hashValue(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseAgreementLicense(value: string): AgreementLicenseConfig {
  const parsed = JSON.parse(value) as Partial<AgreementLicenseConfig>;

  return {
    handle: parsed.handle,
    licenseName: parsed.licenseName || "License",
    legalTemplateFamily: parsed.legalTemplateFamily || "basic",
    streamLimit: parsed.streamLimit || "",
    copyLimit: parsed.copyLimit || "",
    videoViewLimit: parsed.videoViewLimit || "",
    termYears: parsed.termYears || "",
    fileFormats: parsed.fileFormats || "",
    stemsPolicy: parsed.stemsPolicy || "",
    contentIdPolicy: parsed.contentIdPolicy || "",
    syncPolicy: parsed.syncPolicy || "",
    creditRequirement: parsed.creditRequirement || "",
    publishingSplitMode: parsed.publishingSplitMode || "",
    publishingSplitSummary: parsed.publishingSplitSummary || "",
    terms: Array.isArray(parsed.terms) ? parsed.terms : [],
  };
}

function parseLicensorSnapshot(value: string): {
  licensor: AgreementLicensorConfig;
  producerAliases: string;
} {
  const parsed = JSON.parse(value) as {
    licensor?: Partial<AgreementLicensorConfig>;
    producerAliases?: string | null;
  };

  const licensor = parsed.licensor || {};

  return {
    licensor: {
      legalName: licensor.legalName || "Licensor",
      dbaName: licensor.dbaName || "",
      noticeEmail: licensor.noticeEmail || "",
      governingLawRegion: licensor.governingLawRegion || "",
      disputeForum: licensor.disputeForum || "",
      signatureLabel: licensor.signatureLabel || "",
      signatureImageUrl: licensor.signatureImageUrl || "",
    },
    producerAliases: normalizeOptionalString(parsed.producerAliases) || "Producer",
  };
}

async function buildRedactedAgreementArtifact(
  agreement: ExecutedAgreementWithOrder,
) {
  const license = parseAgreementLicense(agreement.resolvedLicenseJson);
  const { licensor, producerAliases } = parseLicensorSnapshot(
    agreement.licensorSnapshotJson,
  );

  const rendered = await renderAgreementPreview({
    mode: "resolved",
    license,
    licensor,
    context: {
      producerAliases,
      customerName: "Redacted Customer",
      customerEmail: "",
      purchaseDate: agreement.order.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      beatTitle: agreement.orderItem.beatTitle,
      licensePrice: "As reflected in checkout",
      orderId: agreement.order.orderNumber,
      templateVersion: agreement.templateVersion || "",
      buyerIp: "",
      userAgent: "",
      stemsIncludedInOrder: agreement.stemsIncludedInOrder,
    },
  });

  const pdfBuffer = await generatePdfFromHtml(rendered.html);

  return {
    renderedHtml: rendered.html,
    htmlHash: hashValue(rendered.html),
    pdfData: pdfBuffer,
    pdfHash: hashValue(pdfBuffer),
    pdfStatus: "generated",
    pdfError: null,
  };
}

export function extractCustomerIdentifiers(
  payload: ShopifyPrivacyPayload | Record<string, unknown>,
): CustomerIdentifiers {
  const customer =
    payload && typeof payload === "object" && "customer" in payload
      ? (payload.customer as ShopifyPrivacyPayload["customer"])
      : null;

  return {
    shopifyCustomerId: normalizeOptionalString(customer?.id),
    customerEmail: normalizeOptionalString(customer?.email),
  };
}

async function findCustomerOrderIds(shop: string, customer: CustomerIdentifiers) {
  const normalizedShop = normalizeShopDomain(shop);
  const orderIds = new Set<string>();

  if (customer.shopifyCustomerId) {
    const matchingOrders = await prisma.order.findMany({
      where: {
        shop: normalizedShop,
        shopifyCustomerId: customer.shopifyCustomerId,
      },
      select: { id: true },
    });

    for (const order of matchingOrders) {
      orderIds.add(order.id);
    }
  }

  if (customer.customerEmail) {
    const matchingAccessRecords = await prisma.deliveryAccess.findMany({
      where: {
        shop: normalizedShop,
        customerEmail: customer.customerEmail,
      },
      select: { orderId: true },
    });

    for (const access of matchingAccessRecords) {
      orderIds.add(access.orderId);
    }
  }

  return Array.from(orderIds);
}

export async function redactCustomerData(
  shop: string,
  customer: CustomerIdentifiers,
) {
  const normalizedShop = normalizeShopDomain(shop);
  const orderIds = await findCustomerOrderIds(normalizedShop, customer);
  const deliveryAccessFilters = [
    orderIds.length > 0 ? { orderId: { in: orderIds } } : null,
    customer.shopifyCustomerId
      ? { shopifyCustomerId: customer.shopifyCustomerId }
      : null,
    customer.customerEmail ? { customerEmail: customer.customerEmail } : null,
  ].filter(Boolean) as Prisma.DeliveryAccessWhereInput[];
  const privacyRequestFilters = [
    customer.shopifyCustomerId
      ? { shopifyCustomerId: customer.shopifyCustomerId }
      : null,
    customer.customerEmail ? { customerEmail: customer.customerEmail } : null,
  ].filter(Boolean) as Prisma.PrivacyDataRequestWhereInput[];

  const deliveryAccessRecords =
    deliveryAccessFilters.length > 0
      ? await prisma.deliveryAccess.findMany({
          where: {
            shop: normalizedShop,
            OR: deliveryAccessFilters,
          },
          select: { id: true },
        })
      : [];

  const executedAgreements =
    orderIds.length > 0
      ? await prisma.executedAgreement.findMany({
          where: {
            shop: normalizedShop,
            orderId: { in: orderIds },
          },
          include: {
            order: {
              select: {
                orderNumber: true,
                createdAt: true,
              },
            },
            orderItem: {
              select: {
                beatTitle: true,
              },
            },
          },
        })
      : [];

  await prisma.$transaction([
    prisma.order.updateMany({
      where: {
        shop: normalizedShop,
        id: { in: orderIds.length > 0 ? orderIds : ["__none__"] },
      },
      data: {
        browserIp: null,
        userAgent: null,
        acceptLanguage: null,
        shopifyCustomerId: null,
      },
    }),
    ...(privacyRequestFilters.length > 0
      ? [
          prisma.privacyDataRequest.updateMany({
            where: {
              shop: normalizedShop,
              OR: privacyRequestFilters,
            },
            data: {
              customerEmail: null,
              requestPayloadJson: JSON.stringify({
                redacted: true,
                redactedAt: new Date().toISOString(),
              }),
              exportJson: null,
            },
          }),
        ]
      : []),
  ]);

  for (const record of deliveryAccessRecords) {
    await prisma.deliveryAccess.update({
      where: { id: record.id },
      data: {
        shopifyCustomerId: null,
        customerName: null,
        customerEmail: "",
        downloadToken: buildRedactedDownloadToken(),
        deliveryEmailRecipient: null,
        deliveryEmailError: null,
        deliveryEmailMessageId: null,
        deliveryEmailConfirmedStatus: null,
        deliveryEmailConfirmedAt: null,
        deliveryEmailConfirmedError: null,
        deliveryEmailLastEvent: null,
        deliveryEmailLastEventAt: null,
      },
    });
  }

  for (const agreement of executedAgreements) {
    const artifact = await buildRedactedAgreementArtifact(agreement);

    await prisma.executedAgreement.update({
      where: { id: agreement.id },
      data: {
        buyerEmail: null,
        buyerIp: null,
        userAgent: null,
        renderedHtml: artifact.renderedHtml,
        htmlHash: artifact.htmlHash,
        pdfData: artifact.pdfData,
        pdfHash: artifact.pdfHash,
        pdfStatus: artifact.pdfStatus,
        pdfError: artifact.pdfError,
      },
    });
  }

  return {
    redactedOrderCount: orderIds.length,
    redactedDeliveryAccessCount: deliveryAccessRecords.length,
    redactedAgreementCount: executedAgreements.length,
  };
}

export async function deleteShopData(shop: string) {
  const normalizedShop = normalizeShopDomain(shop);

  await prisma.deliveryAccess.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.order.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.shopStorageConfig.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.shopCatalogConfig.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.beatDraft.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.beatFile.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.templateGuardrailAcceptance.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.merchantAcknowledgment.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.session.deleteMany({
    where: { shop: normalizedShop },
  });

  await prisma.privacyDataRequest.deleteMany({
    where: { shop: normalizedShop },
  });
}

export async function runPrivacyMaintenanceForShop(shop: string) {
  const normalizedShop = normalizeShopDomain(shop);
  const privacyRequestCutoff = daysAgo(PRIVACY_REQUEST_RETENTION_DAYS);
  const telemetryCutoff = daysAgo(TELEMETRY_RETENTION_DAYS);
  const deliveryEventCutoff = daysAgo(DELIVERY_EVENT_RETENTION_DAYS);

  await prisma.$transaction([
    prisma.privacyDataRequest.deleteMany({
      where: {
        shop: normalizedShop,
        status: "fulfilled",
        fulfilledAt: { lt: privacyRequestCutoff },
      },
    }),
    prisma.order.updateMany({
      where: {
        shop: normalizedShop,
        createdAt: { lt: telemetryCutoff },
      },
      data: {
        browserIp: null,
        userAgent: null,
        acceptLanguage: null,
      },
    }),
    prisma.executedAgreement.updateMany({
      where: {
        shop: normalizedShop,
        purchasedAt: { lt: telemetryCutoff },
      },
      data: {
        buyerIp: null,
        userAgent: null,
      },
    }),
    prisma.deliveryAccess.updateMany({
      where: {
        shop: normalizedShop,
        createdAt: { lt: deliveryEventCutoff },
      },
      data: {
        deliveryEmailError: null,
        deliveryEmailRecipient: null,
        deliveryEmailMessageId: null,
        deliveryEmailConfirmedError: null,
        deliveryEmailLastEvent: null,
        deliveryEmailLastEventAt: null,
      },
    }),
  ]);
}
