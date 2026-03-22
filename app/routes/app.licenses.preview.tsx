import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getStarterPresetVersion } from "~/services/metafieldSetup";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import {
  buildDerivedLicenseFields,
  resolveOfferArchetype,
} from "~/services/licenses/archetypes";
import { renderAgreementPreview } from "~/services/licenses/agreementRenderer.server";
import { authenticate } from "~/shopify.server";

function getFieldValue(
  metaobject:
    | {
        fields?: Array<{ key: string; value: string }>;
      }
    | null
    | undefined,
  key: string,
) {
  return metaobject?.fields?.find((field) => field.key === key)?.value || "";
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const setupService = createMetafieldSetupService(session, admin);

  const previewMode =
    formData.get("previewMode") === "starter" ? "starter" : "resolved";
  const licenseHandle = String(formData.get("handle") || "").trim();
  const offerArchetype = resolveOfferArchetype({
    offerArchetype: String(formData.get("offerArchetype") || "").trim(),
    licenseId: String(formData.get("licenseId") || "").trim(),
    legalTemplateFamily: String(
      formData.get("legalTemplateFamily") || "",
    ).trim(),
    handle: licenseHandle,
  });
  const derivedFields = buildDerivedLicenseFields(offerArchetype, {
    stemsPolicy: String(formData.get("stemsPolicy") || "").trim(),
  });

  const [licensorMetaobject, producerMetaobject] = await Promise.all([
    setupService.getDefaultLicensor(),
    setupService.getPrimaryProducer(),
  ]);

  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const license = {
    handle: licenseHandle,
    licenseName: String(formData.get("licenseName") || "").trim(),
    offerArchetype,
    legalTemplateFamily: derivedFields.legalTemplateFamily,
    streamLimit: String(formData.get("streamLimit") || "").trim(),
    copyLimit: String(formData.get("copyLimit") || "").trim(),
    videoViewLimit: String(formData.get("videoViewLimit") || "").trim(),
    termYears: String(formData.get("termYears") || "").trim(),
    fileFormats: derivedFields.fileFormats,
    stemsPolicy: derivedFields.stemsPolicy,
    contentIdPolicy: String(
      formData.get("contentIdPolicy") || "not_allowed",
    ).trim(),
    syncPolicy: String(formData.get("syncPolicy") || "not_included").trim(),
    creditRequirement: String(
      formData.get("creditRequirement") || "required",
    ).trim(),
    publishingSplitMode: String(
      formData.get("publishingSplitMode") || "fixed_split",
    ).trim(),
    publishingSplitSummary: String(
      formData.get("publishingSplitSummary") || "",
    ).trim(),
    terms: Array.from({ length: 6 }, (_, index) =>
      String(formData.get(`term${index + 1}`) || "").trim(),
    ),
  };

  const licensor = {
    legalName: getFieldValue(licensorMetaobject, "legal_name"),
    dbaName: getFieldValue(licensorMetaobject, "dba_name"),
    noticeEmail: getFieldValue(licensorMetaobject, "notice_email"),
    governingLawRegion: getFieldValue(
      licensorMetaobject,
      "governing_law_region",
    ),
    disputeForum: getFieldValue(licensorMetaobject, "dispute_forum"),
    signatureLabel: getFieldValue(licensorMetaobject, "signature_label"),
    signatureImageUrl: "",
  };

  const producerAliases =
    getFieldValue(producerMetaobject, "name") ||
    licensor.dbaName ||
    licensor.legalName;
  const starterVersion =
    (licenseHandle && getStarterPresetVersion(licenseHandle)) ||
    `preview-${derivedFields.legalTemplateFamily || "basic"}`;

  try {
    const preview = await renderAgreementPreview({
      mode: previewMode,
      license,
      licensor,
      context: {
        producerAliases,
        customerName: "Sample Artist",
        customerEmail: "artist@example.com",
        purchaseDate: now,
        beatTitle: "Sample Beat Title",
        licensePrice: "$0.00",
        orderId: "ORDER-12345",
        templateVersion: starterVersion,
        buyerIp: "198.51.100.42",
        userAgent: "Preview browser session",
      },
    });

    return json({
      success: true,
      family: preview.family,
      mode: previewMode,
      html: preview.html,
    });
  } catch (error) {
    console.error("Agreement preview error:", error);
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to render agreement preview.",
      },
      { status: 500 },
    );
  }
};
