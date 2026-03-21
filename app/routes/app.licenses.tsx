import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banner,
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  FormLayout,
  Icon,
  IndexTable,
  InlineStack,
  Layout,
  List,
  Page,
  Popover,
  Select,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
import { CollectionIcon } from "@shopify/polaris-icons";
import { FileFormatBadge } from "~/components/FileFormatBadge";
import { LegalGuardrailModal } from "~/components/LegalGuardrailModal";
import prisma from "~/db.server";
import {
  DEFAULT_LICENSES,
  getStarterPresetVersion,
} from "~/services/metafieldSetup";
import { createProductCreatorService } from "~/services/productCreator";
import { createShopifyClient } from "~/services/shopify";
import { authenticate } from "~/shopify.server";

type LicenseTemplate = {
  id: string;
  handle: string;
  licenseId: string;
  licenseName: string;
  legalTemplateFamily: string;
  streamLimit: string;
  copyLimit: string;
  videoViewLimit: string;
  termYears: string;
  fileFormats: string;
  stemsPolicy: string;
  storefrontSummary: string;
  featuresShort: string;
  contentIdPolicy: string;
  syncPolicy: string;
  creditRequirement: string;
  publishingSplitMode: string;
  publishingSplitSummary: string;
  terms: string[];
  isStarter: boolean;
  starterVersion: string | null;
  hasAcceptedGuardrail: boolean;
};

type LicenseUsageSummary = {
  beatCount: number;
  beatTitles: string[];
};

type LicenseFormState = {
  id?: string;
  handle: string;
  licenseId: string;
  licenseName: string;
  legalTemplateFamily: string;
  streamLimit: string;
  copyLimit: string;
  videoViewLimit: string;
  termYears: string;
  fileFormats: string;
  stemsPolicy: string;
  storefrontSummary: string;
  featuresShort: string;
  contentIdPolicy: string;
  syncPolicy: string;
  creditRequirement: string;
  publishingSplitMode: string;
  publishingSplitSummary: string;
  terms: string[];
};

type PackageFormat = "MP3" | "WAV" | "STEMS";

type ActionDataShape = {
  success: boolean;
  intent?: string;
  error?: string;
  requiresGuardrail?: boolean;
  templateHandle?: string;
  starterVersion?: string | null;
};

type AgreementPreviewData = {
  success: boolean;
  family?: string;
  mode?: "starter" | "resolved";
  html?: string;
  error?: string;
};

const PACKAGE_FORMAT_ORDER: PackageFormat[] = ["MP3", "WAV", "STEMS"];
const LEGAL_TEMPLATE_FAMILY_OPTIONS = [
  { label: "Basic", value: "basic" },
  { label: "Premium", value: "premium" },
  { label: "Unlimited", value: "unlimited" },
];
const STEMS_POLICY_OPTIONS = [
  { label: "Not offered", value: "not_available" },
  { label: "Available as add-on", value: "available_as_addon" },
  { label: "Included by default", value: "included_by_default" },
];
const CONTENT_ID_POLICY_OPTIONS = [
  { label: "Not allowed", value: "not_allowed" },
  {
    label: "Allowed for the finished song only",
    value: "allowed_for_new_song_only",
  },
];
const SYNC_POLICY_OPTIONS = [
  { label: "Not included", value: "not_included" },
  { label: "Standard online video only", value: "standard_online_video_only" },
  { label: "Limited sync with approval", value: "limited_sync_with_approval" },
];
const CREDIT_REQUIREMENT_OPTIONS = [
  { label: "Required", value: "required" },
  { label: "Commercially reasonable", value: "commercially_reasonable" },
  { label: "Not required", value: "not_required" },
];
const PUBLISHING_SPLIT_MODE_OPTIONS = [
  { label: "Fixed split", value: "fixed_split" },
  { label: "Custom split summary", value: "custom_split_summary" },
  { label: "Left to the parties", value: "left_to_parties" },
];

const STARTER_HANDLES = new Set(
  DEFAULT_LICENSES.map((license) => license.handle),
);
const DYNAMIC_TEMPLATE_FIELDS = [
  "[[license_name]]",
  "[[customer_name]]",
  "[[governing_law_region]]",
  "[[stems_clause]]",
] as const;
const AGREEMENT_PREVIEW_TABS = [
  { id: "resolved", content: "With my settings" },
  { id: "starter", content: "Starter template" },
];

const emptyLicenseForm = (): LicenseFormState => ({
  handle: "",
  licenseId: "",
  licenseName: "",
  legalTemplateFamily: "basic",
  streamLimit: "",
  copyLimit: "",
  videoViewLimit: "",
  termYears: "",
  fileFormats: "",
  stemsPolicy: "available_as_addon",
  storefrontSummary: "",
  featuresShort: "",
  contentIdPolicy: "not_allowed",
  syncPolicy: "not_included",
  creditRequirement: "required",
  publishingSplitMode: "fixed_split",
  publishingSplitSummary: "50% Licensor / 50% Licensee",
  terms: ["", "", "", "", "", ""],
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function coerceOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized;
}

function appendLicenseFormFields(
  formData: FormData,
  licenseForm: LicenseFormState,
) {
  if (licenseForm.id) formData.append("id", licenseForm.id);
  if (licenseForm.handle) formData.append("handle", licenseForm.handle);
  if (licenseForm.licenseId)
    formData.append("licenseId", licenseForm.licenseId);
  formData.append("licenseName", licenseForm.licenseName);
  formData.append("legalTemplateFamily", licenseForm.legalTemplateFamily);
  formData.append("streamLimit", licenseForm.streamLimit);
  formData.append("copyLimit", licenseForm.copyLimit);
  formData.append("videoViewLimit", licenseForm.videoViewLimit);
  formData.append("termYears", licenseForm.termYears);
  formData.append("fileFormats", licenseForm.fileFormats);
  formData.append("stemsPolicy", licenseForm.stemsPolicy);
  formData.append("storefrontSummary", licenseForm.storefrontSummary);
  formData.append("featuresShort", licenseForm.featuresShort);
  formData.append("contentIdPolicy", licenseForm.contentIdPolicy);
  formData.append("syncPolicy", licenseForm.syncPolicy);
  formData.append("creditRequirement", licenseForm.creditRequirement);
  formData.append("publishingSplitMode", licenseForm.publishingSplitMode);
  formData.append("publishingSplitSummary", licenseForm.publishingSplitSummary);
  licenseForm.terms.forEach((term, index) => {
    formData.append(`term${index + 1}`, term);
  });
}

function buildLicenseForm(license?: LicenseTemplate): LicenseFormState {
  if (!license) return emptyLicenseForm();

  return {
    id: license.id,
    handle: license.handle,
    licenseId: license.licenseId,
    licenseName: license.licenseName,
    legalTemplateFamily: license.legalTemplateFamily || "basic",
    streamLimit: license.streamLimit,
    copyLimit: license.copyLimit,
    videoViewLimit: license.videoViewLimit,
    termYears: license.termYears,
    fileFormats: license.fileFormats,
    stemsPolicy: license.stemsPolicy || "not_available",
    storefrontSummary: license.storefrontSummary,
    featuresShort: license.featuresShort,
    contentIdPolicy: license.contentIdPolicy || "not_allowed",
    syncPolicy: license.syncPolicy || "not_included",
    creditRequirement: license.creditRequirement || "required",
    publishingSplitMode: license.publishingSplitMode || "fixed_split",
    publishingSplitSummary:
      license.publishingSplitSummary || "50% Licensor / 50% Licensee",
    terms: [...license.terms, "", "", "", "", "", ""].slice(0, 6),
  };
}

function formatLimit(value: string, unit: string) {
  if (!value || value === "0") return `Unlimited ${unit}`;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return `${value} ${unit}`;
  return `${numeric.toLocaleString()} ${unit}`;
}

function formatTermLength(value: string) {
  if (!value || value === "0") return "Perpetual term";
  if (value === "1") return "1 year term";
  return `${value} year term`;
}

function stemsIncludedByDefault(stemsPolicy: string) {
  return stemsPolicy === "included_by_default";
}

function stemsAddOnAvailable(stemsPolicy: string) {
  return stemsPolicy === "available_as_addon";
}

function formatTemplateFamilyLabel(value: string) {
  return (
    LEGAL_TEMPLATE_FAMILY_OPTIONS.find((option) => option.value === value)
      ?.label || "Basic"
  );
}

function formatStemsPolicyLabel(value: string) {
  return (
    STEMS_POLICY_OPTIONS.find((option) => option.value === value)?.label ||
    "Not offered"
  );
}

function countCustomTerms(terms: string[]) {
  return terms.filter((term) => term.trim().length > 0).length;
}

function parseFeatureLines(value: string) {
  return value
    .split("\n")
    .map((feature) => feature.trim())
    .filter(Boolean);
}

function parseFileFormatBadges(value: string) {
  return value
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);
}

function normalizePackageFormat(value: string): PackageFormat | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "MP3") return "MP3";
  if (normalized === "WAV") return "WAV";
  if (
    normalized === "STEMS" ||
    normalized === "STEMS ZIP" ||
    normalized === "ZIP"
  ) {
    return "STEMS";
  }
  return null;
}

function getSelectedPackageFormats(fileFormats: string, stemsPolicy: string) {
  const selected = new Set<PackageFormat>();

  parseFileFormatBadges(fileFormats).forEach((format) => {
    const normalized = normalizePackageFormat(format);
    if (normalized) selected.add(normalized);
  });

  if (stemsIncludedByDefault(stemsPolicy)) {
    selected.add("STEMS");
  } else {
    selected.delete("STEMS");
  }

  return PACKAGE_FORMAT_ORDER.filter((format) => selected.has(format));
}

function formatPackageFormats(formats: string[]) {
  return PACKAGE_FORMAT_ORDER.filter((format) => formats.includes(format)).join(
    ", ",
  );
}

function syncFileFormatsWithStemsPolicy(
  fileFormats: string,
  stemsPolicy: string,
) {
  const selected = new Set(getSelectedPackageFormats(fileFormats, stemsPolicy));

  if (stemsIncludedByDefault(stemsPolicy)) {
    selected.add("STEMS");
  } else {
    selected.delete("STEMS");
  }

  return formatPackageFormats(
    PACKAGE_FORMAT_ORDER.filter((format) => selected.has(format)),
  );
}

function normalizeSessionUserId(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value))
    return BigInt(value);

  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

function getLicenseStatus(
  license: LicenseTemplate,
  usage: LicenseUsageSummary | undefined,
): { label: string; tone?: "success" | "attention" } {
  if (
    !license.licenseId.trim() ||
    !license.fileFormats.trim() ||
    !license.legalTemplateFamily.trim()
  ) {
    return { label: "Needs setup", tone: "attention" };
  }

  if (!usage || usage.beatCount === 0) {
    return { label: "Unused" };
  }

  return { label: "Ready", tone: "success" };
}

async function getLicenseUsage(admin: {
  graphql: (query: string, options?: Record<string, any>) => Promise<Response>;
}): Promise<Record<string, LicenseUsageSummary>> {
  const usageByLicenseId = new Map<string, Set<string>>();
  let hasNextPage = true;
  let cursor: string | null = null;

  const query = `
    query LicenseUsage($cursor: String) {
      products(first: 100, after: $cursor, query: "product_type:Beat") {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          metafield(namespace: "custom", key: "beat_licenses") {
            references(first: 25) {
              nodes {
                ... on Metaobject {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const response = await admin.graphql(query, { variables: { cursor } });
    const payload = (await response.json()) as {
      data?: {
        products?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            title: string;
            metafield?: {
              references?: {
                nodes: Array<{ id: string }>;
              };
            } | null;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.products;
    if (!connection) break;

    for (const product of connection.nodes) {
      const titlesByLicense = product.metafield?.references?.nodes ?? [];
      for (const licenseRef of titlesByLicense) {
        const existing =
          usageByLicenseId.get(licenseRef.id) ?? new Set<string>();
        existing.add(product.title);
        usageByLicenseId.set(licenseRef.id, existing);
      }
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return Object.fromEntries(
    [...usageByLicenseId.entries()].map(([licenseId, beatTitles]) => [
      licenseId,
      {
        beatCount: beatTitles.size,
        beatTitles: [...beatTitles].sort((a, b) => a.localeCompare(b)),
      },
    ]),
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const productService = createProductCreatorService(session, admin);

  try {
    const starterHandles = [...STARTER_HANDLES];
    const [licenses, licenseUsageById, guardrailAcceptances] =
      await Promise.all([
        productService.getLicenseMetaobjects(),
        getLicenseUsage(admin),
        prisma.templateGuardrailAcceptance.findMany({
          where: {
            shop: session.shop,
            templateHandle: { in: starterHandles },
          },
          select: {
            templateHandle: true,
            starterVersion: true,
          },
        }),
      ]);

    const acceptedStarterKeys = new Set(
      guardrailAcceptances.map(
        (acceptance: { templateHandle: string; starterVersion: string }) =>
          `${acceptance.templateHandle}:${acceptance.starterVersion}`,
      ),
    );

    const normalizedLicenses: LicenseTemplate[] = licenses
      .map((license) => ({
        ...license,
        isStarter: STARTER_HANDLES.has(license.handle),
        starterVersion: getStarterPresetVersion(license.handle),
        hasAcceptedGuardrail: false,
      }))
      .map((license) => ({
        ...license,
        hasAcceptedGuardrail:
          license.isStarter && license.starterVersion
            ? acceptedStarterKeys.has(
                `${license.handle}:${license.starterVersion}`,
              )
            : true,
      }))
      .sort((a, b) => {
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
        return a.licenseName.localeCompare(b.licenseName);
      });

    return json({
      licenses: normalizedLicenses,
      licenseUsageById,
      error: null,
    });
  } catch (error) {
    console.error("License loader error:", error);
    return json(
      {
        licenses: [] as LicenseTemplate[],
        licenseUsageById: {} as Record<string, LicenseUsageSummary>,
        error:
          error instanceof Error ? error.message : "Failed to load licenses",
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const client = createShopifyClient(session, admin);
  const sessionUserId = normalizeSessionUserId(
    (session as { userId?: unknown }).userId,
  );
  const sessionEmail =
    typeof (session as { email?: unknown }).email === "string"
      ? (session as { email?: string }).email || null
      : null;

  if (intent === "accept_guardrail") {
    const templateHandle = String(formData.get("templateHandle") || "").trim();
    const templateMetaobjectId = String(
      formData.get("templateMetaobjectId") || "",
    ).trim();
    const starterVersion = getStarterPresetVersion(templateHandle);

    if (
      !templateHandle ||
      !STARTER_HANDLES.has(templateHandle) ||
      !starterVersion
    ) {
      return json(
        {
          success: false,
          intent,
          error: "This Starter Preset cannot be reviewed right now.",
        } satisfies ActionDataShape,
        { status: 400 },
      );
    }

    await prisma.templateGuardrailAcceptance.upsert({
      where: {
        shop_templateHandle_starterVersion: {
          shop: session.shop,
          templateHandle,
          starterVersion,
        },
      },
      update: {
        templateMetaobjectId,
        acceptedAt: new Date(),
        acceptedByUserId: sessionUserId,
        acceptedByEmail: sessionEmail,
      },
      create: {
        shop: session.shop,
        templateHandle,
        templateMetaobjectId,
        starterVersion,
        acceptedAt: new Date(),
        acceptedByUserId: sessionUserId,
        acceptedByEmail: sessionEmail,
      },
    });

    return json({
      success: true,
      intent,
      templateHandle,
      starterVersion,
    } satisfies ActionDataShape);
  }

  const licenseName = String(formData.get("licenseName") || "").trim();
  const normalizedHandle =
    String(formData.get("handle") || "").trim() || slugify(licenseName);
  const normalizedLicenseId =
    String(formData.get("licenseId") || "").trim() || slugify(licenseName);

  const fields = [
    { key: "license_id", value: normalizedLicenseId },
    { key: "license_name", value: licenseName },
    {
      key: "legal_template_family",
      value: String(formData.get("legalTemplateFamily") || "basic").trim(),
    },
    {
      key: "stream_limit",
      value: coerceOptionalNumber(formData.get("streamLimit")),
    },
    {
      key: "copy_limit",
      value: coerceOptionalNumber(formData.get("copyLimit")),
    },
    {
      key: "video_view_limit",
      value: coerceOptionalNumber(formData.get("videoViewLimit")),
    },
    {
      key: "term_years",
      value: coerceOptionalNumber(formData.get("termYears")),
    },
    {
      key: "file_formats",
      value: String(formData.get("fileFormats") || "").trim(),
    },
    {
      key: "stems_policy",
      value: String(formData.get("stemsPolicy") || "not_available"),
    },
    {
      key: "storefront_summary",
      value: String(formData.get("storefrontSummary") || "").trim(),
    },
    {
      key: "features_short",
      value: String(formData.get("featuresShort") || "").trim(),
    },
    {
      key: "content_id_policy",
      value: String(formData.get("contentIdPolicy") || "not_allowed").trim(),
    },
    {
      key: "sync_policy",
      value: String(formData.get("syncPolicy") || "not_included").trim(),
    },
    {
      key: "credit_requirement",
      value: String(formData.get("creditRequirement") || "required").trim(),
    },
    {
      key: "publishing_split_mode",
      value: String(
        formData.get("publishingSplitMode") || "fixed_split",
      ).trim(),
    },
    {
      key: "publishing_split_summary",
      value: String(formData.get("publishingSplitSummary") || "").trim(),
    },
    { key: "term_1", value: String(formData.get("term1") || "").trim() },
    { key: "term_2", value: String(formData.get("term2") || "").trim() },
    { key: "term_3", value: String(formData.get("term3") || "").trim() },
    { key: "term_4", value: String(formData.get("term4") || "").trim() },
    { key: "term_5", value: String(formData.get("term5") || "").trim() },
    { key: "term_6", value: String(formData.get("term6") || "").trim() },
  ];

  if (!licenseName) {
    return json(
      {
        success: false,
        intent,
        error: "Template name is required.",
      } satisfies ActionDataShape,
      { status: 400 },
    );
  }

  if (!normalizedHandle || !normalizedLicenseId) {
    return json(
      {
        success: false,
        intent,
        error:
          "A valid template name is required to generate the preset handle.",
      },
      { status: 400 },
    );
  }

  try {
    if (intent === "create") {
      await client.createMetaobject({
        type: "beat_license",
        handle: normalizedHandle,
        fields,
      });

      return json({ success: true, intent } satisfies ActionDataShape);
    }

    if (intent === "update") {
      const id = String(formData.get("id") || "");
      const starterVersion = getStarterPresetVersion(normalizedHandle);

      if (!id) {
        return json(
          {
            success: false,
            intent,
            error: "Missing template id.",
          } satisfies ActionDataShape,
          { status: 400 },
        );
      }

      if (STARTER_HANDLES.has(normalizedHandle) && starterVersion) {
        const acceptance = await prisma.templateGuardrailAcceptance.findUnique({
          where: {
            shop_templateHandle_starterVersion: {
              shop: session.shop,
              templateHandle: normalizedHandle,
              starterVersion,
            },
          },
        });

        if (!acceptance) {
          return json(
            {
              success: false,
              intent,
              error:
                "Review and accept this Starter Preset before saving changes.",
              requiresGuardrail: true,
              templateHandle: normalizedHandle,
              starterVersion,
            } satisfies ActionDataShape,
            { status: 403 },
          );
        }
      }

      await client.updateMetaobject({
        id,
        fields,
      });

      return json({ success: true, intent } satisfies ActionDataShape);
    }

    return json(
      {
        success: false,
        intent,
        error: "Unknown intent",
      } satisfies ActionDataShape,
      { status: 400 },
    );
  } catch (error) {
    console.error("License action error:", error);
    return json(
      {
        success: false,
        intent,
        error:
          error instanceof Error ? error.message : "Failed to save template",
      },
      { status: 500 },
    );
  }
};

export default function LicensesPage() {
  const {
    licenses,
    licenseUsageById,
    error: loaderError,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | ActionDataShape
    | undefined;
  const guardrailFetcher = useFetcher<ActionDataShape>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const [licenseForm, setLicenseForm] =
    useState<LicenseFormState>(emptyLicenseForm);
  const [selectedPreviewTab, setSelectedPreviewTab] = useState(0);
  const [activeRightsPopoverId, setActiveRightsPopoverId] = useState<
    string | null
  >(null);
  const [activeDeliveryPopoverId, setActiveDeliveryPopoverId] = useState<
    string | null
  >(null);
  const [activeUsagePopoverId, setActiveUsagePopoverId] = useState<
    string | null
  >(null);
  const [guardrailModalTemplate, setGuardrailModalTemplate] =
    useState<LicenseTemplate | null>(null);
  const [pendingEditHandle, setPendingEditHandle] = useState<string | null>(
    null,
  );
  const [previewState, setPreviewState] = useState<{
    html: string;
    error: string | null;
    isLoading: boolean;
  }>({
    html: "",
    error: null,
    isLoading: false,
  });
  const [acceptedStarterVersions, setAcceptedStarterVersions] = useState<
    Record<string, string>
  >({});
  const previewRequestSequence = useRef(0);

  const editingHandle = searchParams.get("edit");
  const isCreating = searchParams.get("new") === "1";
  const savedState = searchParams.get("saved");
  const licensesWithGuardrailState = useMemo(
    () =>
      licenses.map((license) => {
        const locallyAcceptedVersion = acceptedStarterVersions[license.handle];
        const hasAcceptedGuardrail =
          license.isStarter && license.starterVersion
            ? license.hasAcceptedGuardrail ||
              locallyAcceptedVersion === license.starterVersion
            : true;

        return {
          ...license,
          hasAcceptedGuardrail,
        };
      }),
    [acceptedStarterVersions, licenses],
  );
  const editorLicense = useMemo(
    () =>
      licensesWithGuardrailState.find(
        (license) => license.handle === editingHandle,
      ) || null,
    [licensesWithGuardrailState, editingHandle],
  );
  const editorMode: "create" | "update" | null = isCreating
    ? "create"
    : editorLicense
      ? "update"
      : null;
  const isEditorOpen = editorMode !== null;
  const previewMode = selectedPreviewTab === 0 ? "resolved" : "starter";
  const previewRequestPayload = useMemo(
    () =>
      JSON.stringify({
        previewMode,
        handle: licenseForm.handle,
        licenseId: licenseForm.licenseId,
        licenseName: licenseForm.licenseName,
        legalTemplateFamily: licenseForm.legalTemplateFamily,
        streamLimit: licenseForm.streamLimit,
        copyLimit: licenseForm.copyLimit,
        videoViewLimit: licenseForm.videoViewLimit,
        termYears: licenseForm.termYears,
        fileFormats: licenseForm.fileFormats,
        stemsPolicy: licenseForm.stemsPolicy,
        storefrontSummary: licenseForm.storefrontSummary,
        featuresShort: licenseForm.featuresShort,
        contentIdPolicy: licenseForm.contentIdPolicy,
        syncPolicy: licenseForm.syncPolicy,
        creditRequirement: licenseForm.creditRequirement,
        publishingSplitMode: licenseForm.publishingSplitMode,
        publishingSplitSummary: licenseForm.publishingSplitSummary,
        terms: licenseForm.terms,
      }),
    [licenseForm, previewMode],
  );
  const actionError = actionData?.error ?? null;
  const guardrailError =
    guardrailFetcher.data?.intent === "accept_guardrail" &&
    !guardrailFetcher.data.success
      ? guardrailFetcher.data.error || "Unable to record your review right now."
      : null;
  const previewError = previewState.error;
  const previewHtml = previewState.html;
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post" &&
    navigation.formData?.get("intent") !== "accept_guardrail";
  const isAcceptingGuardrail =
    guardrailFetcher.state !== "idle" ||
    (navigation.state === "submitting" &&
      navigation.formMethod?.toLowerCase() === "post" &&
      navigation.formData?.get("intent") === "accept_guardrail");
  const isPreviewLoading = previewState.isLoading;
  const requiresEditorGuardrail = Boolean(
    editorLicense?.isStarter &&
    editorLicense.starterVersion &&
    !editorLicense.hasAcceptedGuardrail,
  );

  useEffect(() => {
    if (editorMode === "create") {
      setLicenseForm(emptyLicenseForm());
      setSelectedPreviewTab(0);
      return;
    }

    if (editorMode === "update" && editorLicense) {
      setLicenseForm(buildLicenseForm(editorLicense));
      setSelectedPreviewTab(0);
    }
  }, [editorMode, editorLicense]);

  useEffect(() => {
    if (!isEditorOpen) {
      setPreviewState({
        html: "",
        error: null,
        isLoading: false,
      });
      return;
    }

    const previewPayload = JSON.parse(previewRequestPayload) as {
      previewMode: "starter" | "resolved";
      handle: string;
      licenseId: string;
      licenseName: string;
      legalTemplateFamily: string;
      streamLimit: string;
      copyLimit: string;
      videoViewLimit: string;
      termYears: string;
      fileFormats: string;
      stemsPolicy: string;
      storefrontSummary: string;
      featuresShort: string;
      contentIdPolicy: string;
      syncPolicy: string;
      creditRequirement: string;
      publishingSplitMode: string;
      publishingSplitSummary: string;
      terms: string[];
    };

    const previewFormData = new FormData();
    previewFormData.append("previewMode", previewPayload.previewMode);
    appendLicenseFormFields(previewFormData, {
      handle: previewPayload.handle,
      licenseId: previewPayload.licenseId,
      licenseName: previewPayload.licenseName,
      legalTemplateFamily: previewPayload.legalTemplateFamily,
      streamLimit: previewPayload.streamLimit,
      copyLimit: previewPayload.copyLimit,
      videoViewLimit: previewPayload.videoViewLimit,
      termYears: previewPayload.termYears,
      fileFormats: previewPayload.fileFormats,
      stemsPolicy: previewPayload.stemsPolicy,
      storefrontSummary: previewPayload.storefrontSummary,
      featuresShort: previewPayload.featuresShort,
      contentIdPolicy: previewPayload.contentIdPolicy,
      syncPolicy: previewPayload.syncPolicy,
      creditRequirement: previewPayload.creditRequirement,
      publishingSplitMode: previewPayload.publishingSplitMode,
      publishingSplitSummary: previewPayload.publishingSplitSummary,
      terms: previewPayload.terms,
    });

    const requestSequence = ++previewRequestSequence.current;
    const abortController = new AbortController();

    setPreviewState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }));

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/app/licenses/preview", {
            method: "POST",
            body: previewFormData,
            signal: abortController.signal,
          });

          const data = (await response.json()) as AgreementPreviewData;

          if (
            abortController.signal.aborted ||
            requestSequence !== previewRequestSequence.current
          ) {
            return;
          }

          if (!response.ok || !data.success) {
            setPreviewState((current) => ({
              ...current,
              error: data.error || "Unable to render the agreement preview.",
              isLoading: false,
            }));
            return;
          }

          setPreviewState({
            html: data.html || "",
            error: null,
            isLoading: false,
          });
        } catch (error) {
          if (
            abortController.signal.aborted ||
            requestSequence !== previewRequestSequence.current
          ) {
            return;
          }

          setPreviewState((current) => ({
            ...current,
            error:
              error instanceof Error
                ? error.message
                : "Unable to render the agreement preview.",
            isLoading: false,
          }));
        }
      })();
    }, 120);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isEditorOpen, previewRequestPayload]);

  useEffect(() => {
    if (
      actionData?.success &&
      (actionData.intent === "update" || actionData.intent === "create")
    ) {
      const nextSavedState =
        actionData.intent === "update" ? "updated" : "created";
      navigate(`/app/licenses?saved=${nextSavedState}`, { replace: true });
    }
  }, [actionData, navigate]);

  useEffect(() => {
    if (
      guardrailFetcher.data?.success &&
      guardrailFetcher.data.intent === "accept_guardrail"
    ) {
      const acceptedHandle = guardrailFetcher.data.templateHandle;
      const acceptedVersion = guardrailFetcher.data.starterVersion;

      if (acceptedHandle && acceptedVersion) {
        setAcceptedStarterVersions((current) => ({
          ...current,
          [acceptedHandle]: acceptedVersion,
        }));
      }

      setGuardrailModalTemplate(null);

      if (pendingEditHandle && acceptedHandle === pendingEditHandle) {
        setPendingEditHandle(null);
        navigate(`/app/licenses?edit=${acceptedHandle}`);
      }
    }
  }, [guardrailFetcher.data, navigate, pendingEditHandle]);

  useEffect(() => {
    if (editorMode === "update" && editorLicense && requiresEditorGuardrail) {
      setGuardrailModalTemplate(editorLicense);
    }
  }, [editorLicense, editorMode, requiresEditorGuardrail]);

  useEffect(() => {
    if (actionData?.requiresGuardrail && editorLicense) {
      setGuardrailModalTemplate(editorLicense);
    }
  }, [actionData, editorLicense]);

  const handleOpenCreate = useCallback(() => {
    navigate("/app/licenses?new=1");
  }, [navigate]);

  const handleOpenEdit = useCallback(
    (license: LicenseTemplate) => {
      if (
        license.isStarter &&
        license.starterVersion &&
        !license.hasAcceptedGuardrail
      ) {
        setPendingEditHandle(license.handle);
        setGuardrailModalTemplate(license);
        return;
      }

      navigate(`/app/licenses?edit=${license.handle}`);
    },
    [navigate],
  );

  const handleCloseEditor = useCallback(() => {
    setGuardrailModalTemplate(null);
    setPendingEditHandle(null);
    navigate("/app/licenses");
  }, [navigate]);

  const handleCloseGuardrailModal = useCallback(() => {
    setGuardrailModalTemplate(null);

    if (pendingEditHandle) {
      setPendingEditHandle(null);
    }

    if (editorMode === "update" && requiresEditorGuardrail) {
      navigate("/app/licenses");
    }
  }, [editorMode, navigate, pendingEditHandle, requiresEditorGuardrail]);

  const handleAcceptGuardrail = useCallback(() => {
    if (!guardrailModalTemplate?.starterVersion) return;

    const formData = new FormData();
    formData.append("intent", "accept_guardrail");
    formData.append("templateHandle", guardrailModalTemplate.handle);
    formData.append("templateMetaobjectId", guardrailModalTemplate.id);
    formData.append("starterVersion", guardrailModalTemplate.starterVersion);

    guardrailFetcher.submit(formData, { method: "post" });
  }, [guardrailFetcher, guardrailModalTemplate]);

  const handleRightsPopoverToggle = useCallback((licenseId: string) => {
    setActiveRightsPopoverId((current) =>
      current === licenseId ? null : licenseId,
    );
  }, []);

  const handleDeliveryPopoverToggle = useCallback((licenseId: string) => {
    setActiveDeliveryPopoverId((current) =>
      current === licenseId ? null : licenseId,
    );
  }, []);

  const handleUsagePopoverToggle = useCallback((licenseId: string) => {
    setActiveUsagePopoverId((current) =>
      current === licenseId ? null : licenseId,
    );
  }, []);

  const handleSave = useCallback(() => {
    if (
      editorMode === "update" &&
      editorLicense?.isStarter &&
      requiresEditorGuardrail
    ) {
      setGuardrailModalTemplate(editorLicense);
      return;
    }

    const formData = new FormData();
    formData.append("intent", editorMode || "create");
    appendLicenseFormFields(formData, licenseForm);

    submit(formData, { method: "post" });
  }, [editorLicense, editorMode, licenseForm, requiresEditorGuardrail, submit]);

  if (isEditorOpen) {
    const usage = editorLicense
      ? licenseUsageById[editorLicense.id]
      : undefined;
    const usageBeatsUrl = editorLicense
      ? `/app/beats?license=${encodeURIComponent(editorLicense.id)}`
      : "/app/beats";
    const previewFeatures = parseFeatureLines(licenseForm.featuresShort);
    const fileBadges = parseFileFormatBadges(licenseForm.fileFormats);
    const customTermCount = countCustomTerms(licenseForm.terms);
    const selectedPackageFormats = getSelectedPackageFormats(
      licenseForm.fileFormats,
      licenseForm.stemsPolicy,
    );
    const isStarter = editorLicense?.isStarter || false;
    const previewStatus =
      editorMode === "create"
        ? { label: "Draft" as const, tone: undefined }
        : editorLicense
          ? getLicenseStatus(editorLicense, usage)
          : { label: "Draft" as const, tone: undefined };

    return (
      <>
        <Page
          fullWidth
          title={
            editorMode === "create"
              ? "New Reusable Template"
              : licenseForm.licenseName || "Edit Template"
          }
          subtitle="Configure storefront copy, usage limits, delivery packaging, and reusable agreement language for this template."
          backAction={{ content: "Templates", onAction: handleCloseEditor }}
          primaryAction={{
            content:
              editorMode === "create" ? "Create template" : "Save changes",
            onAction: handleSave,
            loading: isSaving,
            disabled:
              !licenseForm.licenseName.trim() || requiresEditorGuardrail,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseEditor,
            },
          ]}
        >
          <Layout>
            {actionError && (
              <Layout.Section>
                <Banner title="Unable to save template" tone="critical">
                  <p>{actionError}</p>
                </Banner>
              </Layout.Section>
            )}

            {guardrailError && (
              <Layout.Section>
                <Banner title="Unable to record review" tone="critical">
                  <p>{guardrailError}</p>
                </Banner>
              </Layout.Section>
            )}

            {requiresEditorGuardrail && editorLicense ? (
              <Layout.Section>
                <Banner
                  title="Review required before editing this Starter Preset"
                  tone="warning"
                  action={{
                    content: "Review & Accept",
                    onAction: handleAcceptGuardrail,
                    loading: isAcceptingGuardrail,
                  }}
                >
                  <p>
                    These templates are professional starting points. Producer
                    Launchpad is a technical delivery tool and does not provide
                    legal advice.
                  </p>
                </Banner>
              </Layout.Section>
            ) : null}

            <Layout.Section>
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="h2" variant="headingMd">
                          Identity
                        </Text>
                        <Text as="p" tone="subdued">
                          Use a clear template name your team will recognize
                          across storefront offers, checkout records, and
                          delivery history.
                        </Text>
                      </BlockStack>
                      {editorMode === "update" ? (
                        isStarter ? (
                          <Badge tone="success">Starter Preset</Badge>
                        ) : (
                          <Badge>Reusable Template</Badge>
                        )
                      ) : null}
                    </InlineStack>

                    <TextField
                      label="Preset ID"
                      value={licenseForm.licenseId}
                      onChange={(value) =>
                        setLicenseForm((current) => ({
                          ...current,
                          licenseId: value,
                        }))
                      }
                      autoComplete="off"
                      helpText="Matches the required beat_license metaobject field used by your storefront and delivery logic."
                    />

                    <TextField
                      label="Template name"
                      value={licenseForm.licenseName}
                      onChange={(value) =>
                        setLicenseForm((current) => ({
                          ...current,
                          licenseName: value,
                        }))
                      }
                      autoComplete="off"
                      helpText="This name is customer-facing and can be used for storefront marketing. The legal rights still follow the selected template family."
                    />

                    <Select
                      label="Legal template family"
                      options={LEGAL_TEMPLATE_FAMILY_OPTIONS}
                      value={licenseForm.legalTemplateFamily}
                      onChange={(value) =>
                        setLicenseForm((current) => ({
                          ...current,
                          legalTemplateFamily: value,
                        }))
                      }
                      helpText="This controls the legal rights model behind the offer, regardless of the customer-facing name."
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Rights and limits
                      </Text>
                      <Text as="p" tone="subdued">
                        Set the usage boundaries buyers receive when they select
                        this template.
                      </Text>
                    </BlockStack>

                    <FormLayout>
                      <FormLayout.Group>
                        <TextField
                          label="Stream limit"
                          type="number"
                          value={licenseForm.streamLimit}
                          onChange={(value) =>
                            setLicenseForm((current) => ({
                              ...current,
                              streamLimit: value,
                            }))
                          }
                          helpText="Use 0 for unlimited."
                          autoComplete="off"
                        />
                        <TextField
                          label="Copy limit"
                          type="number"
                          value={licenseForm.copyLimit}
                          onChange={(value) =>
                            setLicenseForm((current) => ({
                              ...current,
                              copyLimit: value,
                            }))
                          }
                          helpText="Use 0 for unlimited."
                          autoComplete="off"
                        />
                      </FormLayout.Group>

                      <TextField
                        label="Video view limit"
                        type="number"
                        value={licenseForm.videoViewLimit}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            videoViewLimit: value,
                          }))
                        }
                        helpText="Use 0 for unlimited."
                        autoComplete="off"
                      />

                      <TextField
                        label="Term (years)"
                        type="number"
                        value={licenseForm.termYears}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            termYears: value,
                          }))
                        }
                        helpText="Use 0 for a perpetual term."
                        autoComplete="off"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Delivery package
                      </Text>
                      <Text as="p" tone="subdued">
                        Define the audio package and storefront summary paired
                        with this Reusable Template.
                      </Text>
                    </BlockStack>

                    <FormLayout>
                      <ChoiceList
                        title="Included files"
                        allowMultiple
                        choices={[
                          { label: "MP3", value: "MP3" },
                          { label: "WAV", value: "WAV" },
                          { label: "STEMS ZIP", value: "STEMS" },
                        ]}
                        selected={selectedPackageFormats}
                        onChange={(selected) =>
                          setLicenseForm((current) => {
                            const nextStemsPolicy = selected.includes("STEMS")
                              ? "included_by_default"
                              : current.stemsPolicy === "included_by_default"
                                ? "available_as_addon"
                                : current.stemsPolicy;

                            return {
                              ...current,
                              stemsPolicy: nextStemsPolicy,
                              fileFormats: syncFileFormatsWithStemsPolicy(
                                formatPackageFormats(selected),
                                nextStemsPolicy,
                              ),
                            };
                          })
                        }
                      />

                      <TextField
                        label="File formats"
                        value={licenseForm.fileFormats}
                        autoComplete="off"
                        readOnly
                        helpText="Locked to the delivery package above so storefront messaging matches what is actually delivered."
                      />

                      <Text as="p" tone="subdued">
                        {stemsIncludedByDefault(licenseForm.stemsPolicy)
                          ? "Stems are included in the base package for this offer."
                          : stemsAddOnAvailable(licenseForm.stemsPolicy)
                            ? "Stems are not included by default, but can be sold as an add-on."
                            : "Stems are not offered on this template."}
                      </Text>

                      <Select
                        label="Stems handling"
                        options={STEMS_POLICY_OPTIONS}
                        value={licenseForm.stemsPolicy}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            stemsPolicy: value,
                            fileFormats: syncFileFormatsWithStemsPolicy(
                              current.fileFormats,
                              value,
                            ),
                          }))
                        }
                        helpText="Choose whether stems are unavailable, offered as an add-on, or included by default. The final agreement will also reflect whether stems were actually included in the order."
                      />

                      <TextField
                        label="Storefront summary"
                        value={licenseForm.storefrontSummary}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            storefrontSummary: value,
                          }))
                        }
                        multiline={3}
                        autoComplete="off"
                        helpText="Short paragraph used for customer-facing summary copy."
                      />

                      <TextField
                        label="Feature bullets"
                        value={licenseForm.featuresShort}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            featuresShort: value,
                          }))
                        }
                        multiline={5}
                        autoComplete="off"
                        helpText="One line per feature. This summary is shown to buyers when they compare options."
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Rights configuration
                      </Text>
                      <Text as="p" tone="subdued">
                        Choose the controlled legal options that will select the
                        right clause language when Producer Launchpad renders
                        the final agreement.
                      </Text>
                    </BlockStack>

                    <FormLayout>
                      <Select
                        label="Content ID policy"
                        options={CONTENT_ID_POLICY_OPTIONS}
                        value={licenseForm.contentIdPolicy}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            contentIdPolicy: value,
                          }))
                        }
                      />

                      <Select
                        label="Sync policy"
                        options={SYNC_POLICY_OPTIONS}
                        value={licenseForm.syncPolicy}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            syncPolicy: value,
                          }))
                        }
                      />

                      <Select
                        label="Credit requirement"
                        options={CREDIT_REQUIREMENT_OPTIONS}
                        value={licenseForm.creditRequirement}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            creditRequirement: value,
                          }))
                        }
                      />

                      <Select
                        label="Publishing split mode"
                        options={PUBLISHING_SPLIT_MODE_OPTIONS}
                        value={licenseForm.publishingSplitMode}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            publishingSplitMode: value,
                          }))
                        }
                      />

                      <TextField
                        label="Publishing split summary"
                        value={licenseForm.publishingSplitSummary}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            publishingSplitSummary: value,
                          }))
                        }
                        multiline={2}
                        autoComplete="off"
                        helpText="Used when the selected publishing mode renders a summary into the agreement."
                      />

                      <Text as="p" tone="subdued">
                        Addendum terms below are appended to the starter
                        agreement. They do not replace the core legal clauses.
                      </Text>

                      {licenseForm.terms.map((term, index) => (
                        <TextField
                          key={`term-${index + 1}`}
                          label={`Addendum term ${index + 1}`}
                          value={term}
                          onChange={(value) =>
                            setLicenseForm((current) => {
                              const nextTerms = [...current.terms];
                              nextTerms[index] = value;
                              return { ...current, terms: nextTerms };
                            })
                          }
                          multiline={3}
                          autoComplete="off"
                        />
                      ))}
                    </FormLayout>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Agreement preview
                      </Text>
                      <Badge tone={previewStatus.tone}>
                        {previewStatus.label}
                      </Badge>
                    </InlineStack>

                    <Tabs
                      tabs={AGREEMENT_PREVIEW_TABS}
                      selected={selectedPreviewTab}
                      onSelect={setSelectedPreviewTab}
                      fitted
                    >
                      <BlockStack gap="300">
                        <Text as="p" tone="subdued">
                          {previewMode === "resolved"
                            ? "Preview how this agreement reads with your current settings, legal identity, and sample buyer data."
                            : "Review the starter agreement language with placeholders still visible so you can inspect the raw template structure."}
                        </Text>

                        <InlineStack gap="200">
                          <Badge>
                            {previewMode === "resolved"
                              ? "Resolved preview"
                              : "Starter template"}
                          </Badge>
                          <Badge>
                            {formatTemplateFamilyLabel(
                              licenseForm.legalTemplateFamily,
                            )}
                          </Badge>
                          {isPreviewLoading ? (
                            <Badge tone="attention">Updating</Badge>
                          ) : null}
                        </InlineStack>

                        {previewError ? (
                          <Banner
                            title="Unable to render preview"
                            tone="critical"
                          >
                            <p>{previewError}</p>
                          </Banner>
                        ) : null}

                        <div
                          style={{
                            border: "1px solid var(--p-color-border)",
                            borderRadius: "12px",
                            overflow: "hidden",
                            minHeight: "760px",
                            background: "var(--p-color-bg-surface)",
                          }}
                        >
                          {previewHtml ? (
                            <iframe
                              key={`${previewMode}-${licenseForm.licenseName}-${licenseForm.legalTemplateFamily}`}
                              title="Agreement preview"
                              srcDoc={previewHtml}
                              style={{
                                width: "100%",
                                minHeight: "760px",
                                border: "0",
                                background: "white",
                              }}
                            />
                          ) : (
                            <Box padding="400">
                              <Text as="p" tone="subdued">
                                {isPreviewLoading
                                  ? "Rendering agreement preview."
                                  : "Preview content will appear here as soon as the template has enough data to render."}
                              </Text>
                            </Box>
                          )}
                        </div>
                      </BlockStack>
                    </Tabs>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Offer summary
                      </Text>
                      <Badge>
                        {formatStemsPolicyLabel(licenseForm.stemsPolicy)}
                      </Badge>
                    </InlineStack>

                    <BlockStack gap="100">
                      <Text as="p" variant="headingLg" fontWeight="semibold">
                        {licenseForm.licenseName || "Untitled template"}
                      </Text>
                      <Text as="p" tone="subdued">
                        {formatTemplateFamilyLabel(
                          licenseForm.legalTemplateFamily,
                        )}{" "}
                        legal family
                      </Text>
                      <Text as="p" tone="subdued">
                        {formatLimit(licenseForm.streamLimit, "streams")}
                      </Text>
                      <Text as="p" tone="subdued">
                        {formatLimit(licenseForm.copyLimit, "copies")}
                      </Text>
                      <Text as="p" tone="subdued">
                        {formatLimit(licenseForm.videoViewLimit, "video views")}
                      </Text>
                      <Text as="p" tone="subdued">
                        {formatTermLength(licenseForm.termYears)}
                      </Text>
                    </BlockStack>

                    {fileBadges.length > 0 ? (
                      <InlineStack gap="200">
                        {fileBadges.map((format) => (
                          <FileFormatBadge key={format} format={format} />
                        ))}
                      </InlineStack>
                    ) : (
                      <Text as="p" tone="subdued">
                        Add file formats to preview the delivery package.
                      </Text>
                    )}

                    <InlineStack gap="200">
                      {stemsIncludedByDefault(licenseForm.stemsPolicy) ? (
                        <Badge tone="success">Stems included</Badge>
                      ) : stemsAddOnAvailable(licenseForm.stemsPolicy) ? (
                        <Badge tone="attention">Stems add-on available</Badge>
                      ) : (
                        <Badge>No stems</Badge>
                      )}
                    </InlineStack>

                    {licenseForm.storefrontSummary ? (
                      <Text as="p" tone="subdued">
                        {licenseForm.storefrontSummary}
                      </Text>
                    ) : null}

                    {previewFeatures.length > 0 ? (
                      <List type="bullet">
                        {previewFeatures.slice(0, 4).map((feature) => (
                          <List.Item key={feature}>{feature}</List.Item>
                        ))}
                      </List>
                    ) : (
                      <Text as="p" tone="subdued">
                        Add storefront summary lines to preview how the offer
                        reads at a glance.
                      </Text>
                    )}
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Dynamic fields inserted at checkout
                    </Text>
                    <Text as="p" tone="subdued">
                      These highlighted variables are filled with store and
                      order data. They show that Producer Launchpad is inserting
                      your data into reusable text, not writing bespoke terms on
                      the fly.
                    </Text>
                    <InlineStack gap="200" wrap>
                      {DYNAMIC_TEMPLATE_FIELDS.map((field) => (
                        <Box
                          key={field}
                          background="bg-surface-secondary"
                          borderRadius="200"
                          padding="200"
                        >
                          <Text as="span" variant="bodySm" fontWeight="medium">
                            {field}
                          </Text>
                        </Box>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CollectionIcon} />
                      <Text as="h2" variant="headingMd">
                        Automation summary
                      </Text>
                    </InlineStack>

                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="span">Agreement generation</Text>
                        <Badge tone="success">Automatic</Badge>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span">Portal and file delivery</Text>
                        <Badge tone="success">Automatic</Badge>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span">Reusable sections</Text>
                        <Text as="span">
                          {customTermCount} section
                          {customTermCount === 1 ? "" : "s"}
                        </Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span">Assigned beats</Text>
                        <Text as="span">{usage?.beatCount || 0}</Text>
                      </InlineStack>
                    </BlockStack>

                    <Text as="p" tone="subdued">
                      Once a buyer selects this template, Producer Launchpad
                      prepares the agreement summary, sends the delivery email,
                      and tracks the order inside Deliveries.
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Used by beats
                      </Text>
                      <Badge>{String(usage?.beatCount || 0)}</Badge>
                    </InlineStack>

                    {usage?.beatTitles.length ? (
                      <List type="bullet">
                        {usage.beatTitles.slice(0, 6).map((title) => (
                          <List.Item key={title}>{title}</List.Item>
                        ))}
                      </List>
                    ) : (
                      <Text as="p" tone="subdued">
                        Assign this template from the beat upload flow or a
                        future beat editing flow.
                      </Text>
                    )}

                    <InlineStack gap="300">
                      <Button url={usageBeatsUrl}>View matching beats</Button>
                      <Button url="/app/deliveries">Open deliveries</Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          </Layout>
        </Page>

        <LegalGuardrailModal
          open={Boolean(guardrailModalTemplate)}
          templateName={guardrailModalTemplate?.licenseName || "Starter Preset"}
          accepting={isAcceptingGuardrail}
          onAccept={handleAcceptGuardrail}
          onClose={handleCloseGuardrailModal}
        />
      </>
    );
  }

  return (
    <>
      <Page
        fullWidth
        title="Starter Presets & Reusable Templates"
        subtitle="Manage the Industry Standard Foundations and reusable templates your beat offers reference for storefront display, agreement generation, and delivery packaging."
        primaryAction={{
          content: "Add template",
          onAction: handleOpenCreate,
        }}
      >
        <Layout>
          {loaderError && (
            <Layout.Section>
              <Banner title="Unable to load templates" tone="critical">
                <p>{loaderError}</p>
              </Banner>
            </Layout.Section>
          )}

          {guardrailError && (
            <Layout.Section>
              <Banner title="Unable to record review" tone="critical">
                <p>{guardrailError}</p>
              </Banner>
            </Layout.Section>
          )}

          {savedState && (
            <Layout.Section>
              <Banner
                title={
                  savedState === "updated"
                    ? "Template updated"
                    : "Template created"
                }
                tone="success"
              />
            </Layout.Section>
          )}

          {editingHandle && !editorLicense && !isCreating && (
            <Layout.Section>
              <Banner title="Template not found" tone="warning">
                <p>The selected template could not be found.</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <BlockStack gap="400">
              {licensesWithGuardrailState.length === 0 ? (
                <Card>
                  <Box padding="400">
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        No Reusable Templates yet
                      </Text>
                      <Text as="p" tone="subdued">
                        Create your first template to define storefront copy,
                        usage limits, and delivery options for new beat offers.
                      </Text>
                      <InlineStack>
                        <Button onClick={handleOpenCreate}>Add template</Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
              ) : (
                <Card padding="0">
                  <IndexTable
                    selectable={false}
                    resourceName={{ singular: "template", plural: "templates" }}
                    itemCount={licensesWithGuardrailState.length}
                    headings={[
                      { title: "Template" },
                      { title: "Rights" },
                      { title: "Delivery package" },
                      { title: "Used by" },
                      { title: "Status" },
                      { title: "" },
                    ]}
                  >
                    {licensesWithGuardrailState.map((license, index) => {
                      const usage = licenseUsageById[license.id];
                      const status = getLicenseStatus(license, usage);
                      const customTermCount = countCustomTerms(license.terms);
                      const storefrontSummary = parseFeatureLines(
                        license.featuresShort,
                      );
                      const fileBadges = parseFileFormatBadges(
                        license.fileFormats,
                      );

                      return (
                        <IndexTable.Row
                          key={license.id}
                          id={license.id}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <BlockStack gap="100">
                              <Text
                                as="span"
                                variant="bodyMd"
                                fontWeight="semibold"
                              >
                                {license.licenseName}
                              </Text>
                              <InlineStack gap="200">
                                {license.isStarter ? (
                                  <Badge tone="success">Starter Preset</Badge>
                                ) : (
                                  <Badge>Reusable Template</Badge>
                                )}
                                {license.isStarter &&
                                !license.hasAcceptedGuardrail ? (
                                  <Badge tone="attention">
                                    Review required
                                  </Badge>
                                ) : null}
                              </InlineStack>
                            </BlockStack>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Popover
                              active={activeRightsPopoverId === license.id}
                              autofocusTarget="first-node"
                              preferredAlignment="left"
                              preferredPosition="below"
                              onClose={() => setActiveRightsPopoverId(null)}
                              activator={
                                <Button
                                  disclosure
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                  onClick={() =>
                                    handleRightsPopoverToggle(license.id)
                                  }
                                >
                                  {formatLimit(license.streamLimit, "streams")}
                                </Button>
                              }
                            >
                              <Box padding="400" minWidth="240px">
                                <BlockStack gap="200">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Text
                                      as="p"
                                      variant="headingSm"
                                      fontWeight="semibold"
                                    >
                                      Usage boundaries
                                    </Text>
                                    {license.isStarter ? (
                                      <Badge tone="success">
                                        Starter Preset
                                      </Badge>
                                    ) : (
                                      <Badge>Reusable Template</Badge>
                                    )}
                                  </InlineStack>
                                  <Text as="p">
                                    {formatLimit(
                                      license.streamLimit,
                                      "streams",
                                    )}
                                  </Text>
                                  <Text as="p">
                                    {formatLimit(license.copyLimit, "copies")}
                                  </Text>
                                  <Text as="p">
                                    {formatTermLength(license.termYears)}
                                  </Text>
                                  <Text as="p" tone="subdued">
                                    {customTermCount} reusable section
                                    {customTermCount === 1 ? "" : "s"}
                                  </Text>
                                </BlockStack>
                              </Box>
                            </Popover>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Popover
                              active={activeDeliveryPopoverId === license.id}
                              autofocusTarget="first-node"
                              preferredAlignment="left"
                              preferredPosition="below"
                              onClose={() => setActiveDeliveryPopoverId(null)}
                              activator={
                                <Button
                                  disclosure
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                  onClick={() =>
                                    handleDeliveryPopoverToggle(license.id)
                                  }
                                >
                                  {fileBadges.length > 0
                                    ? `${fileBadges.length} formats`
                                    : "No formats"}
                                </Button>
                              }
                            >
                              <Box padding="400" minWidth="260px">
                                <BlockStack gap="300">
                                  <Text
                                    as="p"
                                    variant="headingSm"
                                    fontWeight="semibold"
                                  >
                                    Delivery files
                                  </Text>
                                  {fileBadges.length > 0 ? (
                                    <InlineStack gap="200">
                                      {fileBadges.map((format) => (
                                        <FileFormatBadge
                                          key={format}
                                          format={format}
                                        />
                                      ))}
                                    </InlineStack>
                                  ) : (
                                    <Text as="p" tone="subdued">
                                      No file formats listed yet
                                    </Text>
                                  )}

                                  <InlineStack gap="200">
                                    {stemsIncludedByDefault(
                                      license.stemsPolicy,
                                    ) ? (
                                      <Badge tone="success">
                                        Stems included
                                      </Badge>
                                    ) : stemsAddOnAvailable(
                                        license.stemsPolicy,
                                      ) ? (
                                      <Badge tone="attention">
                                        Stems add-on available
                                      </Badge>
                                    ) : (
                                      <Badge>No stems</Badge>
                                    )}
                                  </InlineStack>

                                  {storefrontSummary.length > 0 ? (
                                    <List type="bullet">
                                      {storefrontSummary
                                        .slice(0, 3)
                                        .map((feature) => (
                                          <List.Item key={feature}>
                                            {feature}
                                          </List.Item>
                                        ))}
                                    </List>
                                  ) : (
                                    <Text as="p" tone="subdued">
                                      No storefront summary yet
                                    </Text>
                                  )}
                                </BlockStack>
                              </Box>
                            </Popover>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Popover
                              active={activeUsagePopoverId === license.id}
                              autofocusTarget="first-node"
                              preferredAlignment="left"
                              preferredPosition="below"
                              onClose={() => setActiveUsagePopoverId(null)}
                              activator={
                                <Button
                                  disclosure={
                                    usage?.beatCount ? "down" : undefined
                                  }
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                  onClick={() =>
                                    handleUsagePopoverToggle(license.id)
                                  }
                                >
                                  {usage?.beatCount
                                    ? `${usage.beatCount} beat${usage.beatCount === 1 ? "" : "s"}`
                                    : "Not used yet"}
                                </Button>
                              }
                            >
                              <Box padding="400" minWidth="320px">
                                <BlockStack gap="300">
                                  <Text
                                    as="p"
                                    variant="headingSm"
                                    fontWeight="semibold"
                                  >
                                    Beats using this template
                                  </Text>
                                  {usage?.beatTitles.length ? (
                                    <List type="bullet">
                                      {usage.beatTitles
                                        .slice(0, 6)
                                        .map((title) => (
                                          <List.Item key={title}>
                                            {title}
                                          </List.Item>
                                        ))}
                                    </List>
                                  ) : (
                                    <Text as="p" tone="subdued">
                                      Assign this template to beats from the
                                      upload or beat editing flow.
                                    </Text>
                                  )}
                                  <Text as="p" tone="subdued">
                                    {usage?.beatCount
                                      ? `${usage.beatCount} beat${usage.beatCount === 1 ? "" : "s"} currently reference this template`
                                      : "No beats reference this template yet"}
                                  </Text>
                                  <InlineStack>
                                    <Button
                                      variant="plain"
                                      url={`/app/beats?license=${encodeURIComponent(license.id)}`}
                                    >
                                      View in Beats
                                    </Button>
                                  </InlineStack>
                                </BlockStack>
                              </Box>
                            </Popover>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Tooltip
                              content={
                                status.label === "Ready"
                                  ? "This template is complete and already used by beats in your catalog."
                                  : status.label === "Unused"
                                    ? "This template is ready, but no beats reference it yet."
                                    : "Add core package details before using this template on beats."
                              }
                            >
                              <Badge tone={status.tone}>{status.label}</Badge>
                            </Tooltip>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Button
                              variant="plain"
                              onClick={() => handleOpenEdit(license)}
                            >
                              Edit
                            </Button>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      );
                    })}
                  </IndexTable>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>

      <LegalGuardrailModal
        open={Boolean(guardrailModalTemplate)}
        templateName={guardrailModalTemplate?.licenseName || "Starter Preset"}
        accepting={isAcceptingGuardrail}
        onAccept={handleAcceptGuardrail}
        onClose={handleCloseGuardrailModal}
      />
    </>
  );
}
