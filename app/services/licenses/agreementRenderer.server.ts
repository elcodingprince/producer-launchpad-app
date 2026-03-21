import { readFile } from "node:fs/promises";
import path from "node:path";

export type AgreementTemplateFamily = "basic" | "premium" | "unlimited";
export type AgreementPreviewMode = "starter" | "resolved";

export type AgreementLicenseConfig = {
  handle?: string;
  licenseName: string;
  legalTemplateFamily: string;
  streamLimit: string;
  copyLimit: string;
  videoViewLimit: string;
  termYears: string;
  fileFormats: string;
  stemsPolicy: string;
  contentIdPolicy: string;
  syncPolicy: string;
  creditRequirement: string;
  publishingSplitMode: string;
  publishingSplitSummary: string;
  terms: string[];
};

export type AgreementLicensorConfig = {
  legalName: string;
  dbaName?: string;
  noticeEmail?: string;
  governingLawRegion?: string;
  disputeForum?: string;
  signatureLabel?: string;
  signatureImageUrl?: string;
};

export type AgreementRenderContext = {
  producerAliases?: string;
  customerName?: string;
  customerEmail?: string;
  purchaseDate?: string;
  beatTitle?: string;
  licensePrice?: string;
  orderId?: string;
  templateVersion?: string;
  buyerIp?: string;
  userAgent?: string;
  stemsIncludedInOrder?: boolean;
};

const TEMPLATE_FILE_BY_FAMILY: Record<AgreementTemplateFamily, string> = {
  basic: "basic-license-template.html",
  premium: "premium-license-template.html",
  unlimited: "unlimited-license-template.html",
};

const TEMPLATE_DIR = path.join(
  process.cwd(),
  "app/services/licenses/templates",
);
const templateCache = new Map<AgreementTemplateFamily, string>();

function normalizeTemplateFamily(value: string): AgreementTemplateFamily {
  if (value === "premium" || value === "unlimited") return value;
  return "basic";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function formatNumericDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) return trimmed;
  return numeric.toLocaleString("en-US");
}

function formatUsageDisplay(
  value: string,
  unitLabel: string,
  unlimitedLabel: string,
) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return unlimitedLabel;

  const formatted = formatNumericDisplay(trimmed);
  return `${formatted} ${unitLabel}`;
}

function formatTermDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return "a perpetual term";
  if (trimmed === "1") return "1 year";
  return `${trimmed} years`;
}

function parseFileFormats(value: string) {
  return value
    .split(",")
    .map((format) => format.trim().toUpperCase())
    .filter(Boolean)
    .filter((format, index, values) => values.indexOf(format) === index);
}

function formatList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function resolveDeliveryFormats(
  fileFormats: string,
  stemsPolicy: string,
  stemsIncludedInOrder?: boolean,
) {
  const formats = new Set(parseFileFormats(fileFormats));

  if (stemsPolicy === "included_by_default" || stemsIncludedInOrder) {
    formats.add("STEMS");
  } else if (stemsPolicy !== "included_by_default") {
    formats.delete("STEMS");
  }

  const ordered = ["MP3", "WAV", "STEMS"].filter((format) =>
    formats.has(format),
  );
  return formatList(ordered);
}

function buildLicensorDisplay({ legalName, dbaName }: AgreementLicensorConfig) {
  const normalizedLegalName = legalName.trim();
  const normalizedDba = (dbaName || "").trim();

  if (
    normalizedLegalName &&
    normalizedDba &&
    normalizedDba !== normalizedLegalName
  ) {
    return `${normalizedLegalName} d/b/a ${normalizedDba}`;
  }

  return normalizedLegalName || normalizedDba;
}

function starterToken(
  mode: AgreementPreviewMode,
  token: string,
  resolvedValue: string,
) {
  if (mode === "starter") return token;
  return escapeHtml(resolvedValue);
}

function buildCustomTermsSection(terms: string[]) {
  const nonEmptyTerms = terms.map((term) => term.trim()).filter(Boolean);
  if (nonEmptyTerms.length === 0) return "";

  const items = nonEmptyTerms
    .map((term) => `      <li>${escapeHtml(term)}</li>`)
    .join("\n");

  return [
    "  <h2>Additional merchant terms</h2>",
    "  <ol>",
    items,
    "  </ol>",
  ].join("\n");
}

function buildDeliveryClause(
  mode: AgreementPreviewMode,
  deliveryFormats: string,
) {
  const formattedDeliveryFormats = starterToken(
    mode,
    "[[delivery_formats]]",
    deliveryFormats,
  );

  return `<p>The Licensor will make the following files available for this order: <strong>${formattedDeliveryFormats}</strong>. The Licensee is responsible for downloading and retaining backup copies of the delivered files once access is provided.</p>`;
}

function buildStemsSummarySentence(
  stemsPolicy: string,
  stemsIncludedInOrder: boolean | undefined,
) {
  if (stemsPolicy === "included_by_default" || stemsIncludedInOrder) {
    return "Stems are included with this order.";
  }

  if (stemsPolicy === "available_as_addon") {
    return "Stems are not included by default and require a separate stems purchase if offered by the Licensor.";
  }

  return "Stems are not included with this template.";
}

function buildStemsClause(
  stemsPolicy: string,
  stemsIncludedInOrder: boolean | undefined,
) {
  if (stemsPolicy === "included_by_default" || stemsIncludedInOrder) {
    return "<p>Stems are included in this order. Any stems delivered remain non-transferable and may be used only in connection with the licensed New Song or New Songs permitted under this Agreement.</p>";
  }

  if (stemsPolicy === "available_as_addon") {
    return "<p>Stems are not included in this order unless separately purchased. If the Licensee later purchases a stems add-on from the Licensor, any stems delivered remain subject to this Agreement and may only be used in connection with the licensed New Song or New Songs permitted under this Agreement.</p>";
  }

  return "<p>No stems are granted under this Agreement. Any right to receive or use stems requires a separate written permission or a separate order that expressly includes stems.</p>";
}

function buildContentIdClause(
  mode: AgreementPreviewMode,
  contentIdPolicy: string,
  producerAliases: string,
) {
  if (contentIdPolicy === "allowed_for_new_song_only") {
    const formattedProducerAliases = starterToken(
      mode,
      "[[producer_aliases]]",
      producerAliases,
    );

    return `<p>The Licensee may register only the finished New Song in content identification systems. The Licensee may not register the Beat alone, and the Licensee must not assert claims against the Licensor, ${formattedProducerAliases}, the Licensor's distributors, or other authorized users of the Beat.</p>`;
  }

  return "<p>The Licensee may not register the New Song or the Beat in YouTube Content ID or any similar content identification system without the Licensor's separate written consent.</p>";
}

function buildSyncClause(syncPolicy: string) {
  if (syncPolicy === "standard_online_video_only") {
    return "<p>The Licensee may synchronize the New Song into standard online video content controlled by the Licensee, including uploads to video and social platforms, but not into paid advertising campaigns, theatrical trailers, or third-party brand placements without separate written approval.</p>";
  }

  if (syncPolicy === "limited_sync_with_approval") {
    return "<p>Limited synchronization uses may be approved by the Licensor on a case-by-case basis. Any use outside standard online content controlled by the Licensee requires separate written approval from the Licensor.</p>";
  }

  return "<p>No synchronization rights are granted beyond any expressly stated audiovisual uses in this Agreement.</p>";
}

function buildPublishingClause(
  mode: AgreementPreviewMode,
  publishingSplitMode: string,
  publishingSplitSummary: string,
) {
  if (publishingSplitMode === "left_to_parties") {
    return "<p>Publishing splits, writer shares, and collection administration for the New Song must be agreed separately by the parties and, if needed, reflected in their applicable PRO or publishing registrations.</p>";
  }

  const publishingSummary =
    mode === "starter"
      ? "[[publishing_split_summary]]"
      : escapeHtml(
          publishingSplitSummary.trim() || "50% Licensor / 50% Licensee",
        );

  return `<p>The parties acknowledge the publishing and writer share arrangement for the New Song as follows: ${publishingSummary}. If collection society, PRO, or administrator registrations require more detail, the parties will cooperate to register the New Song consistently with this summary.</p>`;
}

function buildCreditClause(
  mode: AgreementPreviewMode,
  creditRequirement: string,
  producerAliases: string,
) {
  const formattedProducerAliases = starterToken(
    mode,
    "[[producer_aliases]]",
    producerAliases,
  );

  if (creditRequirement === "commercially_reasonable") {
    return `<p>The Licensee will use commercially reasonable efforts to credit the producer as "Produced by ${formattedProducerAliases}" where practical.</p>`;
  }

  if (creditRequirement === "not_required") {
    return `<p>No contractual producer credit is required under this Agreement, although crediting the producer as "Produced by ${formattedProducerAliases}" is encouraged.</p>`;
  }

  return `<p>The Licensee must use commercially reasonable efforts to include credit substantially in the form "Produced by ${formattedProducerAliases}" wherever producer credits are customarily shown for the New Song.</p>`;
}

function buildLicensorSignatureBlock(
  mode: AgreementPreviewMode,
  licensor: AgreementLicensorConfig,
) {
  if (mode === "starter") {
    const titleLine = licensor.signatureLabel?.trim()
      ? `<span class="small">Title: [[signature_label]]</span><br/>`
      : "";

    return `<span class="small">Signed electronically by [[licensor_display]]</span><br/>${titleLine}`;
  }

  const signatureImageUrl = (licensor.signatureImageUrl || "").trim();
  const titleLine = licensor.signatureLabel?.trim()
    ? `<span class="small">Title: ${escapeHtml(licensor.signatureLabel.trim())}</span><br/>`
    : "";

  const imageHtml = signatureImageUrl
    ? `<img class="signature-img" src="${escapeAttribute(signatureImageUrl)}" alt="Licensor signature" />`
    : `<span class="small">Signed electronically by ${escapeHtml(buildLicensorDisplay(licensor) || licensor.legalName.trim())}</span><br/>`;

  return `${imageHtml}${titleLine}`;
}

async function loadTemplate(family: AgreementTemplateFamily) {
  const cached = templateCache.get(family);
  if (cached) return cached;

  const filePath = path.join(TEMPLATE_DIR, TEMPLATE_FILE_BY_FAMILY[family]);
  const template = await readFile(filePath, "utf8");
  templateCache.set(family, template);
  return template;
}

function replaceTokens(template: string, replacements: Record<string, string>) {
  let resolved = template;

  for (const [token, value] of Object.entries(replacements)) {
    resolved = resolved.split(token).join(value);
  }

  return resolved;
}

function wrapRemainingTokensForStarterPreview(template: string) {
  return template.replace(
    /\[\[[a-z0-9_]+\]\]/gi,
    (token) => `<code>${token}</code>`,
  );
}

export async function renderAgreementPreview(options: {
  mode: AgreementPreviewMode;
  license: AgreementLicenseConfig;
  licensor: AgreementLicensorConfig;
  context: AgreementRenderContext;
}) {
  const family = normalizeTemplateFamily(options.license.legalTemplateFamily);
  const template = await loadTemplate(family);
  const resolvedLicensorDisplay = buildLicensorDisplay(options.licensor);
  const resolvedNoticeEmail =
    options.licensor.noticeEmail?.trim() ||
    "the notice email selected by the Licensor in settings";
  const resolvedGoverningLawRegion =
    options.licensor.governingLawRegion?.trim() ||
    "the governing law region selected by the Licensor in settings";
  const resolvedDisputeForum =
    options.licensor.disputeForum?.trim() ||
    "the dispute forum selected by the Licensor in settings";
  const stemsIncludedInOrder = options.context.stemsIncludedInOrder;
  const resolvedProducerAliases =
    options.context.producerAliases?.trim() ||
    options.licensor.dbaName?.trim() ||
    options.licensor.legalName.trim();
  const resolvedBuyerIp =
    options.context.buyerIp?.trim() ||
    (options.mode === "resolved"
      ? "Not captured by Shopify checkout"
      : "198.51.100.42");
  const resolvedUserAgent =
    options.context.userAgent?.trim() ||
    (options.mode === "resolved"
      ? "Not captured by Shopify checkout"
      : "Preview browser session");
  const resolvedDeliveryFormats =
    resolveDeliveryFormats(
      options.license.fileFormats,
      options.license.stemsPolicy,
      stemsIncludedInOrder,
    ) || "the formats included in the order";
  const replacements: Record<string, string> = {
    "[[license_name]]": starterToken(
      options.mode,
      "[[license_name]]",
      options.license.licenseName.trim() || "Untitled template",
    ),
    "[[licensor_display]]": starterToken(
      options.mode,
      "[[licensor_display]]",
      resolvedLicensorDisplay ||
        options.licensor.legalName.trim() ||
        "Licensor",
    ),
    "[[licensor_email]]": starterToken(
      options.mode,
      "[[licensor_email]]",
      resolvedNoticeEmail,
    ),
    "[[producer_aliases]]": starterToken(
      options.mode,
      "[[producer_aliases]]",
      resolvedProducerAliases || "Producer",
    ),
    "[[customer_name]]": starterToken(
      options.mode,
      "[[customer_name]]",
      options.context.customerName?.trim() || "Sample Artist",
    ),
    "[[customer_email]]": starterToken(
      options.mode,
      "[[customer_email]]",
      options.context.customerEmail?.trim() || "artist@example.com",
    ),
    "[[purchase_date]]": starterToken(
      options.mode,
      "[[purchase_date]]",
      options.context.purchaseDate?.trim() || "March 20, 2026",
    ),
    "[[beat_title]]": starterToken(
      options.mode,
      "[[beat_title]]",
      options.context.beatTitle?.trim() || "Sample Beat Title",
    ),
    "[[license_price]]": starterToken(
      options.mode,
      "[[license_price]]",
      options.context.licensePrice?.trim() || "$0.00",
    ),
    "[[order_id]]": starterToken(
      options.mode,
      "[[order_id]]",
      options.context.orderId?.trim() || "ORDER-12345",
    ),
    "[[copy_limit_display]]": starterToken(
      options.mode,
      "[[copy_limit_display]]",
      formatUsageDisplay(
        options.license.copyLimit,
        "copies and sales",
        "Unlimited copies and sales",
      ),
    ),
    "[[stream_limit_display]]": starterToken(
      options.mode,
      "[[stream_limit_display]]",
      formatUsageDisplay(
        options.license.streamLimit,
        "streams",
        "Unlimited streams",
      ),
    ),
    "[[video_view_limit_display]]": starterToken(
      options.mode,
      "[[video_view_limit_display]]",
      formatUsageDisplay(
        options.license.videoViewLimit,
        "video views",
        "Unlimited video views",
      ),
    ),
    "[[term_display]]": starterToken(
      options.mode,
      "[[term_display]]",
      formatTermDisplay(options.license.termYears),
    ),
    "[[delivery_formats]]": starterToken(
      options.mode,
      "[[delivery_formats]]",
      resolvedDeliveryFormats,
    ),
    "[[publishing_split_summary]]": starterToken(
      options.mode,
      "[[publishing_split_summary]]",
      options.license.publishingSplitSummary.trim() ||
        "50% Licensor / 50% Licensee",
    ),
    "[[governing_law_region]]": starterToken(
      options.mode,
      "[[governing_law_region]]",
      resolvedGoverningLawRegion,
    ),
    "[[dispute_forum]]": starterToken(
      options.mode,
      "[[dispute_forum]]",
      resolvedDisputeForum,
    ),
    "[[notice_email]]": starterToken(
      options.mode,
      "[[notice_email]]",
      resolvedNoticeEmail,
    ),
    "[[template_version]]": starterToken(
      options.mode,
      "[[template_version]]",
      options.context.templateVersion?.trim() || `preview-${family}`,
    ),
    "[[buyer_ip]]": starterToken(options.mode, "[[buyer_ip]]", resolvedBuyerIp),
    "[[user_agent]]": starterToken(
      options.mode,
      "[[user_agent]]",
      resolvedUserAgent,
    ),
    "[[delivery_clause]]": buildDeliveryClause(
      options.mode,
      resolvedDeliveryFormats,
    ),
    "[[stems_clause]]": buildStemsClause(
      options.license.stemsPolicy,
      options.context.stemsIncludedInOrder,
    ),
    "[[content_id_clause]]": buildContentIdClause(
      options.mode,
      options.license.contentIdPolicy,
      resolvedProducerAliases || "Producer",
    ),
    "[[sync_clause]]": buildSyncClause(options.license.syncPolicy),
    "[[publishing_clause]]": buildPublishingClause(
      options.mode,
      options.license.publishingSplitMode,
      options.license.publishingSplitSummary,
    ),
    "[[credit_clause]]": buildCreditClause(
      options.mode,
      options.license.creditRequirement,
      resolvedProducerAliases || "Producer",
    ),
    "[[custom_terms_section]]": buildCustomTermsSection(options.license.terms),
    "[[licensor_signature_block]]": buildLicensorSignatureBlock(
      options.mode,
      options.licensor,
    ),
    "[[stems_summary_sentence]]": escapeHtml(
      buildStemsSummarySentence(
        options.license.stemsPolicy,
        options.context.stemsIncludedInOrder,
      ),
    ),
  };

  const resolved = replaceTokens(template, replacements);

  return {
    family,
    html:
      options.mode === "starter"
        ? wrapRemainingTokensForStarterPreview(resolved)
        : resolved,
  };
}
