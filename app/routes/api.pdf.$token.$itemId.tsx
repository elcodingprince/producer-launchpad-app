import crypto from "node:crypto";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { resolveOfferStemsPolicy } from "~/services/deliveryPackages";
import { parseExecutedAgreementLicense } from "~/services/executedAgreements.server";
import { normalizeTemplateFields } from "~/services/licenses/archetypes";
import { renderAgreementPreview } from "~/services/licenses/agreementRenderer.server";
import {
  createMetafieldSetupService,
  getLicenseTemplateVersion,
} from "~/services/metafieldSetup";
import { generatePdfFromHtml } from "~/services/pdf/htmlToPdf.server";
import { unauthenticated } from "~/shopify.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function toShopifyGid(type: string, value: string) {
  return value.startsWith("gid://shopify/")
    ? value
    : `gid://shopify/${type}/${normalizeShopifyResourceId(value)}`;
}

function getFieldValue(
  fields:
    | Array<{
        key: string;
        value: string | null;
      }>
    | undefined
    | null,
  key: string,
) {
  return fields?.find((field) => field.key === key)?.value || "";
}

function formatMoney(
  amount: string | null | undefined,
  currencyCode?: string | null,
) {
  const numeric = Number(amount || "");
  if (!Number.isFinite(numeric)) {
    return "As reflected in checkout";
  }

  if (!currencyCode) {
    return `$${numeric.toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currencyCode}`;
  }
}

function sanitizeFilenameSegment(value: string) {
  return (
    value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "agreement"
  );
}

function hashValue(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchAgreementDocumentData(
  admin: {
    graphql: (
      query: string,
      options?: Record<string, any>,
    ) => Promise<Response>;
  },
  options: {
    orderId: string;
    lineItemId: string;
    variantId: string;
  },
) {
  const query = `#graphql
    query AgreementDocumentData($variantId: ID!, $orderId: ID!) {
      productVariant(id: $variantId) {
        id
        title
        price
        stemsAddonEnabledMetafield: metafield(namespace: "custom", key: "stems_addon_enabled") {
          value
        }
        product {
          id
          title
          vendor
          metafield(namespace: "custom", key: "producer_alias") {
            value
          }
        }
        metafield(namespace: "custom", key: "license_reference") {
          reference {
            ... on Metaobject {
              id
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
      order(id: $orderId) {
        id
        clientIp
        lineItems(first: 100) {
          nodes {
            id
            title
            variantTitle
            quantity
            discountedTotalSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            originalTotalSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            variant {
              id
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: {
      variantId: toShopifyGid("ProductVariant", options.variantId),
      orderId: toShopifyGid("Order", options.orderId),
    },
  });

  const payload = (await response.json()) as {
    data?: {
      productVariant?: {
        id: string;
        title: string;
        price: string;
        product?: {
          id: string;
          title: string;
          vendor: string;
          metafield?: { value?: string | null } | null;
        } | null;
        stemsAddonEnabledMetafield?: {
          value?: string | null;
        } | null;
        metafield?: {
          reference?: {
            id: string;
            handle: string;
            fields?: Array<{ key: string; value: string | null }>;
          } | null;
        } | null;
      } | null;
      order?: {
        id: string;
        clientIp?: string | null;
        lineItems?: {
          nodes: Array<{
            id: string;
            title: string;
            variantTitle?: string | null;
            quantity?: number | null;
            discountedTotalSet?: {
              shopMoney?: {
                amount: string;
                currencyCode: string;
              } | null;
            } | null;
            originalTotalSet?: {
              shopMoney?: {
                amount: string;
                currencyCode: string;
              } | null;
            } | null;
            variant?: { id: string } | null;
          }>;
        } | null;
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const variant = payload.data?.productVariant;
  if (!variant) {
    throw new Error("The purchased Shopify variant could not be found.");
  }

  const licenseReference = variant.metafield?.reference;
  if (!licenseReference?.fields?.length) {
    throw new Error(
      "The purchased license template is missing from the Shopify variant.",
    );
  }

  const normalizedLineItemId = normalizeShopifyResourceId(options.lineItemId);
  const normalizedVariantId = normalizeShopifyResourceId(options.variantId);
  const lineItems = payload.data?.order?.lineItems?.nodes || [];
  const matchingLineItem =
    lineItems.find(
      (lineItem) =>
        normalizeShopifyResourceId(lineItem.id) === normalizedLineItemId,
    ) ||
    lineItems.find(
      (lineItem) =>
        normalizeShopifyResourceId(lineItem.variant?.id || "") ===
        normalizedVariantId,
    ) ||
    null;

  const priceMoney =
    matchingLineItem?.discountedTotalSet?.shopMoney ||
    matchingLineItem?.originalTotalSet?.shopMoney ||
    null;

  return {
    productTitle: variant.product?.title || "",
    producerAlias: variant.product?.metafield?.value?.trim() || "",
    producerVendor: variant.product?.vendor?.trim() || "",
    clientIp: payload.data?.order?.clientIp?.trim() || "",
    stemsAddonEnabled: variant.stemsAddonEnabledMetafield?.value === "true",
    licenseReference,
    licensePrice: priceMoney
      ? formatMoney(priceMoney.amount, priceMoney.currencyCode)
      : formatMoney(variant.price, "USD"),
  };
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token, itemId } = params;

  if (!token || !itemId) {
    return new Response("Invalid request", { status: 400 });
  }

  const deliveryAccess = await prisma.deliveryAccess.findUnique({
    where: { downloadToken: token },
    include: {
      order: {
        include: {
          items: {
            include: {
              executedAgreement: true,
            },
          },
        },
      },
    },
  });

  if (!deliveryAccess) {
    return new Response("Unauthorized", { status: 403 });
  }

  const item = deliveryAccess.order.items.find(
    (orderItem: { id: string }) => orderItem.id === itemId,
  );
  if (!item) {
    return new Response("Unauthorized", { status: 403 });
  }

  const snapshotLicense = parseExecutedAgreementLicense(
    item.executedAgreement?.resolvedLicenseJson,
  );
  const safeFileName = `${sanitizeFilenameSegment(snapshotLicense?.licenseName || item.licenseName)}_${sanitizeFilenameSegment(item.beatTitle)}.pdf`;

  if (item.executedAgreement) {
    try {
      let pdfBuffer = item.executedAgreement.pdfData
        ? Buffer.from(item.executedAgreement.pdfData)
        : null;

      if (!pdfBuffer && item.executedAgreement.renderedHtml) {
        pdfBuffer = await generatePdfFromHtml(
          item.executedAgreement.renderedHtml,
        );

        await prisma.executedAgreement.update({
          where: { id: item.executedAgreement.id },
          data: {
            pdfData: pdfBuffer,
            pdfHash: hashValue(pdfBuffer),
            pdfStatus: "generated",
            pdfError: null,
          },
        });
      }

      if (!pdfBuffer) {
        throw new Error("No stored PDF or HTML snapshot is available.");
      }

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          downloadCount: { increment: 1 },
        },
      });

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(pdfBuffer.byteLength),
          "Content-Disposition": `attachment; filename="${safeFileName}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch (error) {
      console.error("Failed to serve executed agreement PDF:", error);
      return new Response("Failed to generate PDF document", { status: 500 });
    }
  }

  try {
    const { session, admin } = await unauthenticated.admin(deliveryAccess.shop);
    const setupService = createMetafieldSetupService(session, admin);
    const [licensorMetaobject, producerMetaobject, shopifyData] =
      await Promise.all([
        setupService.getDefaultLicensor(),
        setupService.getPrimaryProducer(),
        fetchAgreementDocumentData(admin, {
          orderId: deliveryAccess.order.shopifyOrderId,
          lineItemId: item.shopifyLineId,
          variantId: item.variantId,
        }),
      ]);

    if (!licensorMetaobject) {
      throw new Error(
        "A default licensor must be configured before agreements can be generated.",
      );
    }

    const licenseFields = shopifyData.licenseReference.fields || [];
    const licensorFields = licensorMetaobject.fields || [];
    const licenseHandle =
      shopifyData.licenseReference.handle || "license-template";
    const normalizedFields = normalizeTemplateFields({
      offerArchetype: getFieldValue(licenseFields, "offer_archetype"),
      licenseId: getFieldValue(licenseFields, "license_id"),
      legalTemplateFamily: getFieldValue(
        licenseFields,
        "legal_template_family",
      ),
      handle: licenseHandle,
      stemsPolicy: getFieldValue(licenseFields, "stems_policy"),
      streamLimit: getFieldValue(licenseFields, "stream_limit"),
      copyLimit: getFieldValue(licenseFields, "copy_limit"),
      videoViewLimit: getFieldValue(licenseFields, "video_view_limit"),
      termYears: getFieldValue(licenseFields, "term_years"),
    });
    const licensor = {
      legalName: getFieldValue(licensorFields, "legal_name"),
      dbaName: getFieldValue(licensorFields, "dba_name"),
      noticeEmail: getFieldValue(licensorFields, "notice_email"),
      governingLawRegion: getFieldValue(licensorFields, "governing_law_region"),
      disputeForum: getFieldValue(licensorFields, "dispute_forum"),
      signatureLabel: getFieldValue(licensorFields, "signature_label"),
      signatureImageUrl: "",
    };

    const primaryProducerName =
      getFieldValue(producerMetaobject?.fields, "name") || "";
    const producerAliases =
      shopifyData.producerAlias ||
      primaryProducerName ||
      licensor.dbaName ||
      shopifyData.producerVendor ||
      licensor.legalName;
    const license = {
      handle: licenseHandle,
      offerArchetype: normalizedFields.offerArchetype,
      licenseName:
        getFieldValue(licenseFields, "license_name") || item.licenseName,
      legalTemplateFamily: normalizedFields.legalTemplateFamily,
      streamLimit: normalizedFields.streamLimit,
      copyLimit: normalizedFields.copyLimit,
      videoViewLimit: normalizedFields.videoViewLimit,
      termYears: normalizedFields.termYears,
      fileFormats: normalizedFields.fileFormats,
      stemsPolicy: resolveOfferStemsPolicy(
        normalizedFields.stemsPolicy,
        shopifyData.stemsAddonEnabled,
        normalizedFields.offerArchetype,
      ),
      contentIdPolicy:
        getFieldValue(licenseFields, "content_id_policy") || "not_allowed",
      syncPolicy: getFieldValue(licenseFields, "sync_policy") || "not_included",
      creditRequirement:
        getFieldValue(licenseFields, "credit_requirement") || "required",
      publishingSplitMode:
        getFieldValue(licenseFields, "publishing_split_mode") || "fixed_split",
      publishingSplitSummary: getFieldValue(
        licenseFields,
        "publishing_split_summary",
      ),
      terms: Array.from({ length: 6 }, (_, index) =>
        getFieldValue(licenseFields, `term_${index + 1}`),
      ),
    };

    const agreement = await renderAgreementPreview({
      mode: "resolved",
      license,
      licensor,
      context: {
        producerAliases,
        customerName:
          deliveryAccess.customerName || deliveryAccess.customerEmail,
        customerEmail: deliveryAccess.customerEmail,
        purchaseDate: deliveryAccess.order.createdAt.toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        ),
        beatTitle: item.beatTitle || shopifyData.productTitle,
        licensePrice: shopifyData.licensePrice,
        orderId: deliveryAccess.order.orderNumber,
        templateVersion: getLicenseTemplateVersion(
          licenseHandle,
          licenseFields,
        ),
        buyerIp:
          deliveryAccess.order.browserIp?.trim() || shopifyData.clientIp || "",
        userAgent: deliveryAccess.order.userAgent?.trim() || "",
        stemsIncludedInOrder:
          item.stemsIncludedInOrder ||
          license.stemsPolicy === "included_by_default",
      },
    });

    const pdfBuffer = await generatePdfFromHtml(agreement.html);
    const safeFileName = `${sanitizeFilenameSegment(license.licenseName)}_${sanitizeFilenameSegment(item.beatTitle)}.pdf`;

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        downloadCount: { increment: 1 },
      },
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Failed to generate agreement PDF:", error);
    return new Response("Failed to generate PDF document", { status: 500 });
  }
};
