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
  Checkbox,
  EmptyState,
  FormLayout,
  Icon,
  IndexFilters,
  type IndexFiltersProps,
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
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { CollectionIcon } from "@shopify/polaris-icons";
import { AcknowledgmentModal } from "~/components/AcknowledgmentModal";
import { FileFormatBadge } from "~/components/FileFormatBadge";
import { LegalGuardrailModal } from "~/components/LegalGuardrailModal";
import { SelectableListModal } from "~/components/SelectableListModal";
import prisma from "~/db.server";
import {
  acceptMerchantAcknowledgment,
  hasMerchantAcknowledged,
  MERCHANT_ACKNOWLEDGMENT_KEYS,
  normalizeSessionUserId,
} from "~/services/merchantAcknowledgments.server";
import {
  buildDerivedLicenseFields,
  getOfferArchetypeConfig,
  getOfferLimitPresetConfig,
  OFFER_ARCHETYPE_OPTIONS,
  resolveOfferArchetype,
} from "~/services/licenses/archetypes";
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
  offerArchetype: string;
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

type LicenseBundle = {
  id: string;
  name: string;
  isDefault: boolean;
  isStarterBundle: boolean;
  licenseMetaobjectIds: string[];
  licenseNames: string[];
  updatedAt: string;
};

type LimitPresetFieldKey =
  | "streamLimit"
  | "copyLimit"
  | "videoViewLimit"
  | "termYears";

type LicenseFormState = {
  id?: string;
  handle: string;
  offerArchetype: string;
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

type ActionDataShape = {
  success: boolean;
  intent?: string;
  error?: string;
  requiresGuardrail?: boolean;
  requiresCustomTemplateGuardrail?: boolean;
  templateHandle?: string;
  starterVersion?: string | null;
  bundleId?: string;
};

type AgreementPreviewData = {
  success: boolean;
  family?: string;
  mode?: "starter" | "resolved";
  html?: string;
  error?: string;
};

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
const LICENSE_TABLE_TABS = [
  { id: "all-licenses", content: "All licenses" },
  { id: "bundles", content: "Bundles" },
];
const STARTER_BUNDLE_ID = "starter-preset-bundle";
const STARTER_BUNDLE_NAME = "Starter Preset";

function buildArchetypeBoundForm(
  offerArchetype: string,
  overrides: Partial<LicenseFormState> = {},
): LicenseFormState {
  const derivedFields = buildDerivedLicenseFields(offerArchetype, {
    stemsPolicy: overrides.stemsPolicy,
  });
  const presetConfig = getOfferLimitPresetConfig(derivedFields.offerArchetype);

  const resolvePresetValue = (
    presetValues: string[],
    overrideValue?: string,
  ): string => {
    if (overrideValue && presetValues.includes(overrideValue)) {
      return overrideValue;
    }

    if (overrideValue) {
      const normalizedValue = Number(overrideValue);
      if (!Number.isNaN(normalizedValue) && presetValues.length > 0) {
        return presetValues.reduce((closest, candidate) => {
          const candidateNumber = Number(candidate);
          if (Number.isNaN(candidateNumber)) {
            return closest;
          }

          const closestDistance = Math.abs(Number(closest) - normalizedValue);
          const candidateDistance = Math.abs(candidateNumber - normalizedValue);

          return candidateDistance < closestDistance ? candidate : closest;
        }, presetValues[0]);
      }
    }

    return presetValues[0] || "";
  };

  return {
    handle: overrides.handle || "",
    offerArchetype: derivedFields.offerArchetype,
    licenseName: overrides.licenseName || "",
    legalTemplateFamily: derivedFields.legalTemplateFamily,
    streamLimit: resolvePresetValue(
      presetConfig.streamLimit,
      overrides.streamLimit,
    ),
    copyLimit: resolvePresetValue(presetConfig.copyLimit, overrides.copyLimit),
    videoViewLimit: resolvePresetValue(
      presetConfig.videoViewLimit,
      overrides.videoViewLimit,
    ),
    termYears: resolvePresetValue(presetConfig.termYears, overrides.termYears),
    fileFormats: derivedFields.fileFormats,
    stemsPolicy: derivedFields.stemsPolicy,
    storefrontSummary: overrides.storefrontSummary || "",
    featuresShort: overrides.featuresShort || "",
    contentIdPolicy: overrides.contentIdPolicy || "not_allowed",
    syncPolicy: overrides.syncPolicy || "not_included",
    creditRequirement: overrides.creditRequirement || "required",
    publishingSplitMode: overrides.publishingSplitMode || "fixed_split",
    publishingSplitSummary:
      overrides.publishingSplitSummary || "50% Licensor / 50% Licensee",
    terms: [...(overrides.terms || []), "", "", "", "", "", ""].slice(0, 6),
    ...(overrides.id ? { id: overrides.id } : {}),
  };
}

const emptyLicenseForm = (): LicenseFormState =>
  buildArchetypeBoundForm("basic");

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
  formData.append("offerArchetype", licenseForm.offerArchetype);
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

  const offerArchetype = resolveOfferArchetype({
    offerArchetype: license.offerArchetype,
    legalTemplateFamily: license.legalTemplateFamily,
    handle: license.handle,
  });

  return buildArchetypeBoundForm(offerArchetype, {
    id: license.id,
    handle: license.handle,
    licenseName: license.licenseName,
    stemsPolicy: license.stemsPolicy,
    streamLimit: license.streamLimit,
    copyLimit: license.copyLimit,
    videoViewLimit: license.videoViewLimit,
    termYears: license.termYears,
    storefrontSummary: license.storefrontSummary,
    featuresShort: license.featuresShort,
    contentIdPolicy: license.contentIdPolicy || "not_allowed",
    syncPolicy: license.syncPolicy || "not_included",
    creditRequirement: license.creditRequirement || "required",
    publishingSplitMode: license.publishingSplitMode || "fixed_split",
    publishingSplitSummary:
      license.publishingSplitSummary || "50% Licensor / 50% Licensee",
    terms: license.terms,
  });
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

function formatTemplateFamilyLabel(value: string) {
  return getOfferArchetypeConfig(value).label;
}

function formatPresetValue(field: LimitPresetFieldKey, value: string): string {
  if (field === "termYears") {
    return formatTermLength(value);
  }

  if (value === "0") {
    if (field === "streamLimit") return "Unlimited streams";
    if (field === "copyLimit") return "Unlimited copies";
    return "Unlimited video views";
  }

  const numeric = Number(value);
  const formatted = Number.isNaN(numeric) ? value : numeric.toLocaleString();

  if (field === "streamLimit") return `${formatted} streams`;
  if (field === "copyLimit") return `${formatted} copies`;
  return `${formatted} video views`;
}

function buildPresetOptions(
  field: LimitPresetFieldKey,
  presetValues: string[],
) {
  return presetValues.map((value) => ({
    label: formatPresetValue(field, value),
    value,
  }));
}

function getTemplateStemsBadgeTone(
  stemsPolicy?: string | null,
): "success" | "attention" {
  return stemsPolicy === "included_by_default" ? "success" : "attention";
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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildBundleMembershipSummary(bundleNames: string[]) {
  if (bundleNames.length === 0) {
    return { primary: "Manual only", secondary: [] as string[] };
  }

  return {
    primary: bundleNames[0],
    secondary: bundleNames.slice(1),
  };
}

function getLicenseStatus(
  license: LicenseTemplate,
  usage: LicenseUsageSummary | undefined,
): { label: string; tone?: "success" | "attention" } {
  if (!license.offerArchetype.trim() || !license.fileFormats.trim()) {
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
  const usageByTemplateId = new Map<string, Set<string>>();
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
          usageByTemplateId.get(licenseRef.id) ?? new Set<string>();
        existing.add(product.title);
        usageByTemplateId.set(licenseRef.id, existing);
      }
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return Object.fromEntries(
    [...usageByTemplateId.entries()].map(([templateId, beatTitles]) => [
      templateId,
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
    const [
      licenses,
      licenseUsageById,
      guardrailAcceptances,
      hasAcceptedCustomTemplateGuardrail,
      bundleRecords,
    ] = await Promise.all([
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
      hasMerchantAcknowledged(
        session.shop,
        MERCHANT_ACKNOWLEDGMENT_KEYS.customLicenseTemplateCreation,
      ),
      prisma.licenseBundle.findMany({
        where: { shop: session.shop },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
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

    const starterBundle: LicenseBundle = {
      id: STARTER_BUNDLE_ID,
      name: STARTER_BUNDLE_NAME,
      isDefault: true,
      isStarterBundle: true,
      licenseMetaobjectIds: normalizedLicenses
        .filter((license) => license.isStarter)
        .map((license) => license.id),
      licenseNames: normalizedLicenses
        .filter((license) => license.isStarter)
        .map((license) => license.licenseName),
      updatedAt: new Date().toISOString(),
    };

    const customBundles: LicenseBundle[] = bundleRecords.map((bundle: {
      id: string;
      name: string;
      isDefault: boolean;
      updatedAt: Date;
      items: Array<{
        licenseMetaobjectId: string;
        licenseHandle: string;
      }>;
    }) => ({
      id: bundle.id,
      name: bundle.name,
      isDefault: bundle.isDefault,
      isStarterBundle: false,
      licenseMetaobjectIds: bundle.items.map(
        (item: { licenseMetaobjectId: string }) => item.licenseMetaobjectId,
      ),
      licenseNames: bundle.items
        .map((item: { licenseMetaobjectId: string; licenseHandle: string }) =>
          normalizedLicenses.find(
            (license) => license.id === item.licenseMetaobjectId,
          )?.licenseName || item.licenseHandle,
        )
        .filter(Boolean),
      updatedAt: bundle.updatedAt.toISOString(),
    }));

    return json({
      licenses: normalizedLicenses,
      bundles: [starterBundle, ...customBundles],
      licenseUsageById,
      hasAcceptedCustomTemplateGuardrail,
      error: null,
    });
  } catch (error) {
    console.error("License loader error:", error);
    return json(
      {
        licenses: [] as LicenseTemplate[],
        bundles: [] as LicenseBundle[],
        licenseUsageById: {} as Record<string, LicenseUsageSummary>,
        hasAcceptedCustomTemplateGuardrail: false,
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

  if (intent === "accept_custom_template_guardrail") {
    await acceptMerchantAcknowledgment({
      shop: session.shop,
      acknowledgment:
        MERCHANT_ACKNOWLEDGMENT_KEYS.customLicenseTemplateCreation,
      acceptedByUserId: sessionUserId,
      acceptedByEmail: sessionEmail,
    });

    return json({
      success: true,
      intent,
    } satisfies ActionDataShape);
  }

  if (intent === "create_bundle" || intent === "update_bundle") {
    const bundleName = String(formData.get("bundleName") || "").trim();
    const normalizedName = slugify(bundleName);
    const selectedLicenseIds = formData
      .getAll("licenseIds")
      .map((value) => String(value))
      .filter(Boolean);
    const selectedLicenseHandles = formData
      .getAll("licenseHandles")
      .map((value) => String(value))
      .filter(Boolean);
    const bundleId = String(formData.get("bundleId") || "").trim();

    if (!bundleName || !normalizedName) {
      return json(
        {
          success: false,
          intent,
          error: "Bundle name is required.",
        } satisfies ActionDataShape,
        { status: 400 },
      );
    }

    if (selectedLicenseIds.length === 0) {
      return json(
        {
          success: false,
          intent,
          error: "Select at least one license to include in this bundle.",
        } satisfies ActionDataShape,
        { status: 400 },
      );
    }

    try {
      const data = {
        name: bundleName,
        normalizedName,
        shop: session.shop,
      };

      if (intent === "create_bundle") {
        const createdBundle = await prisma.licenseBundle.create({
          data: {
            ...data,
            items: {
              create: selectedLicenseIds.map((licenseId, index) => ({
                licenseMetaobjectId: licenseId,
                licenseHandle: selectedLicenseHandles[index] || licenseId,
                sortOrder: index,
              })),
            },
          },
        });

        return json({
          success: true,
          intent,
          bundleId: createdBundle.id,
        } satisfies ActionDataShape);
      }

      if (!bundleId) {
        return json(
          {
            success: false,
            intent,
            error: "Missing bundle id.",
          } satisfies ActionDataShape,
          { status: 400 },
        );
      }

      await prisma.licenseBundle.update({
        where: { id: bundleId },
        data: {
          name: bundleName,
          normalizedName,
          items: {
            deleteMany: {},
            create: selectedLicenseIds.map((licenseId, index) => ({
              licenseMetaobjectId: licenseId,
              licenseHandle: selectedLicenseHandles[index] || licenseId,
              sortOrder: index,
            })),
          },
        },
      });

      return json({
        success: true,
        intent,
        bundleId,
      } satisfies ActionDataShape);
    } catch (error) {
      return json(
        {
          success: false,
          intent,
          error:
            error instanceof Error
              ? error.message
              : "Unable to save bundle.",
        } satisfies ActionDataShape,
        { status: 500 },
      );
    }
  }

  if (intent === "add_to_existing_bundles") {
    const bundleIds = formData
      .getAll("bundleIds")
      .map((value) => String(value))
      .filter(Boolean)
      .filter((value) => value !== STARTER_BUNDLE_ID);
    const selectedLicenseIds = formData
      .getAll("licenseIds")
      .map((value) => String(value))
      .filter(Boolean);
    const selectedLicenseHandles = formData
      .getAll("licenseHandles")
      .map((value) => String(value))
      .filter(Boolean);

    if (bundleIds.length === 0) {
      return json(
        {
          success: false,
          intent,
          error: "Select at least one bundle.",
        } satisfies ActionDataShape,
        { status: 400 },
      );
    }

    if (selectedLicenseIds.length === 0) {
      return json(
        {
          success: false,
          intent,
          error: "Select at least one license.",
        } satisfies ActionDataShape,
        { status: 400 },
      );
    }

    await prisma.$transaction(
      bundleIds.flatMap((bundleId) =>
        selectedLicenseIds.map((licenseId, index) =>
          prisma.licenseBundleItem.upsert({
            where: {
              bundleId_licenseMetaobjectId: {
                bundleId,
                licenseMetaobjectId: licenseId,
              },
            },
            update: {
              licenseHandle: selectedLicenseHandles[index] || licenseId,
            },
            create: {
              bundleId,
              licenseMetaobjectId: licenseId,
              licenseHandle: selectedLicenseHandles[index] || licenseId,
              sortOrder: index,
            },
          }),
        ),
      ),
    );

    return json({
      success: true,
      intent,
    } satisfies ActionDataShape);
  }

  const licenseName = String(formData.get("licenseName") || "").trim();
  const normalizedHandle =
    String(formData.get("handle") || "").trim() || slugify(licenseName);
  const normalizedOfferArchetype = resolveOfferArchetype({
    offerArchetype: String(formData.get("offerArchetype") || "").trim(),
    legalTemplateFamily: String(
      formData.get("legalTemplateFamily") || "",
    ).trim(),
    handle: normalizedHandle,
  });
  const derivedFields = buildDerivedLicenseFields(normalizedOfferArchetype, {
    stemsPolicy: String(formData.get("stemsPolicy") || "").trim(),
  });

  const fields = [
    { key: "offer_archetype", value: derivedFields.offerArchetype },
    { key: "license_name", value: licenseName },
    { key: "legal_template_family", value: derivedFields.legalTemplateFamily },
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
      value: derivedFields.fileFormats,
    },
    {
      key: "stems_policy",
      value: derivedFields.stemsPolicy,
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

  if (!normalizedHandle || !normalizedOfferArchetype) {
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
      const hasAcceptedCustomTemplateGuardrail = await hasMerchantAcknowledged(
        session.shop,
        MERCHANT_ACKNOWLEDGMENT_KEYS.customLicenseTemplateCreation,
      );

      if (!hasAcceptedCustomTemplateGuardrail) {
        return json(
          {
            success: false,
            intent,
            error:
              "Review and accept the custom template acknowledgment before creating a template.",
            requiresCustomTemplateGuardrail: true,
          } satisfies ActionDataShape,
          { status: 403 },
        );
      }

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
    bundles,
    licenseUsageById,
    hasAcceptedCustomTemplateGuardrail:
      initialHasAcceptedCustomTemplateGuardrail,
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
  const { mode, setMode } = useSetIndexFiltersMode();

  const [licenseForm, setLicenseForm] =
    useState<LicenseFormState>(emptyLicenseForm);
  const [queryValue, setQueryValue] = useState("");
  const [selectedTableView, setSelectedTableView] = useState(0);
  const [sortSelected, setSortSelected] = useState(["updated desc"]);
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
  const [
    hasAcceptedCustomTemplateGuardrail,
    setHasAcceptedCustomTemplateGuardrail,
  ] = useState(initialHasAcceptedCustomTemplateGuardrail);
  const [customTemplateGuardrailOpen, setCustomTemplateGuardrailOpen] =
    useState(false);
  const [customTemplateGuardrailChecked, setCustomTemplateGuardrailChecked] =
    useState(false);
  const [pendingCreateAfterGuardrail, setPendingCreateAfterGuardrail] =
    useState(false);
  const [bundleModalMode, setBundleModalMode] = useState<
    "create" | "update" | null
  >(null);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [bundleModalName, setBundleModalName] = useState("");
  const [bundleModalSelectedLicenseIds, setBundleModalSelectedLicenseIds] =
    useState<string[]>([]);
  const [initialBundleModalName, setInitialBundleModalName] = useState("");
  const [initialBundleModalSelectedLicenseIds, setInitialBundleModalSelectedLicenseIds] =
    useState<string[]>([]);
  const [bundleModalSearchValue, setBundleModalSearchValue] = useState("");
  const [bundleModalShowSelectedOnly, setBundleModalShowSelectedOnly] =
    useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [addToBundlesModalOpen, setAddToBundlesModalOpen] = useState(false);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [initialSelectedBundleIds, setInitialSelectedBundleIds] = useState<
    string[]
  >([]);
  const [bundleSearchValue, setBundleSearchValue] = useState("");
  const [bundleShowSelectedOnly, setBundleShowSelectedOnly] = useState(false);
  const previewRequestSequence = useRef(0);
  const customTemplateGuardrailFetcher = useFetcher<ActionDataShape>();
  const bundleFetcher = useFetcher<ActionDataShape>();

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
  const bundleNamesByLicenseId = useMemo(() => {
    const next = new Map<string, string[]>();

    for (const license of licensesWithGuardrailState) {
      if (license.isStarter) {
        next.set(license.id, [STARTER_BUNDLE_NAME]);
      }
    }

    for (const bundle of bundles) {
      if (bundle.isStarterBundle) continue;

      for (const licenseId of bundle.licenseMetaobjectIds) {
        const existing = next.get(licenseId) ?? [];
        existing.push(bundle.name);
        next.set(licenseId, existing);
      }
    }

    return next;
  }, [bundles, licensesWithGuardrailState]);
  const filteredLicenses = useMemo(() => {
    const normalizedQuery = queryValue.trim().toLowerCase();

    if (!normalizedQuery) return licensesWithGuardrailState;

    return licensesWithGuardrailState.filter((license) => {
      const bundleNames = bundleNamesByLicenseId.get(license.id) ?? [];
      return (
        license.licenseName.toLowerCase().includes(normalizedQuery) ||
        license.handle.toLowerCase().includes(normalizedQuery) ||
        bundleNames.some((name) => name.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [bundleNamesByLicenseId, licensesWithGuardrailState, queryValue]);
  const filteredBundles = useMemo(() => {
    const normalizedQuery = queryValue.trim().toLowerCase();

    if (!normalizedQuery) return bundles;

    return bundles.filter((bundle) => {
      return (
        bundle.name.toLowerCase().includes(normalizedQuery) ||
        bundle.licenseNames.some((name) =>
          name.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [bundles, queryValue]);
  const {
    selectedResources: selectedLicenseIds,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredLicenses);
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
        offerArchetype: licenseForm.offerArchetype,
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
  const isAcceptingCustomTemplateGuardrail =
    customTemplateGuardrailFetcher.state !== "idle";
  const requiresEditorGuardrail = Boolean(
    editorLicense?.isStarter &&
    editorLicense.starterVersion &&
    !editorLicense.hasAcceptedGuardrail,
  );
  const requiresCreateGuardrail =
    editorMode === "create" && !hasAcceptedCustomTemplateGuardrail;
  const customTemplateGuardrailError =
    customTemplateGuardrailFetcher.data?.intent ===
      "accept_custom_template_guardrail" &&
    !customTemplateGuardrailFetcher.data.success
      ? customTemplateGuardrailFetcher.data.error ||
        "Unable to record your review right now."
      : null;
  const bundleError =
    bundleFetcher.data && !bundleFetcher.data.success
      ? bundleFetcher.data.error || "Unable to save bundle changes right now."
      : null;
  const hasCustomBundles = bundles.some((bundle) => !bundle.isStarterBundle);
  const addableBundles = useMemo(
    () => bundles.filter((bundle) => !bundle.isStarterBundle),
    [bundles],
  );
  const filteredModalLicenses = useMemo(() => {
    const normalizedQuery = bundleModalSearchValue.trim().toLowerCase();
    const baseList = bundleModalShowSelectedOnly
      ? licensesWithGuardrailState.filter((license) =>
          bundleModalSelectedLicenseIds.includes(license.id),
        )
      : licensesWithGuardrailState;

    if (!normalizedQuery) return baseList;

    return baseList.filter((license) =>
      license.licenseName.toLowerCase().includes(normalizedQuery),
    );
  }, [
    bundleModalSearchValue,
    bundleModalSelectedLicenseIds,
    bundleModalShowSelectedOnly,
    licensesWithGuardrailState,
  ]);
  const filteredBundleOptions = useMemo(() => {
    const normalizedQuery = bundleSearchValue.trim().toLowerCase();
    const baseList = bundleShowSelectedOnly
      ? addableBundles.filter((bundle) => selectedBundleIds.includes(bundle.id))
      : addableBundles;

    if (!normalizedQuery) return baseList;

    return baseList.filter((bundle) =>
      bundle.name.toLowerCase().includes(normalizedQuery),
    );
  }, [addableBundles, bundleSearchValue, bundleShowSelectedOnly, selectedBundleIds]);
  const selectedLicenseCount = selectedLicenseIds.length;
  const selectedLicenseLabel = pluralize(selectedLicenseCount, "license");
  const tableTabs = LICENSE_TABLE_TABS;
  const sortOptions = useMemo<IndexFiltersProps["sortOptions"]>(
    () => [
      { label: "Updated newest", value: "updated desc", directionLabel: "Newest" },
    ],
    [],
  );
  const hasBundleModalUnsavedChanges = useMemo(() => {
    const currentIds = [...bundleModalSelectedLicenseIds].sort().join("|");
    const initialIds = [...initialBundleModalSelectedLicenseIds]
      .sort()
      .join("|");

    return (
      bundleModalName.trim() !== initialBundleModalName.trim() ||
      currentIds !== initialIds
    );
  }, [
    bundleModalName,
    bundleModalSelectedLicenseIds,
    initialBundleModalName,
    initialBundleModalSelectedLicenseIds,
  ]);
  const hasAddToBundlesUnsavedChanges = useMemo(() => {
    const currentIds = [...selectedBundleIds].sort().join("|");
    const initialIds = [...initialSelectedBundleIds].sort().join("|");

    return currentIds !== initialIds;
  }, [initialSelectedBundleIds, selectedBundleIds]);
  const bundleModalItems = useMemo(
    () =>
      filteredModalLicenses.map((license) => ({
        id: license.id,
        title: license.licenseName,
        subtitle: `${formatLimit(license.streamLimit, "streams")} • ${parseFileFormatBadges(license.fileFormats).length} formats`,
      })),
    [filteredModalLicenses],
  );
  const bundleOptionItems = useMemo(
    () =>
      filteredBundleOptions.map((bundle) => ({
        id: bundle.id,
        title: bundle.name,
        subtitle: `${pluralize(bundle.licenseNames.length, "license")} included`,
      })),
    [filteredBundleOptions],
  );

  useEffect(() => {
    setHasAcceptedCustomTemplateGuardrail(
      initialHasAcceptedCustomTemplateGuardrail,
    );
  }, [initialHasAcceptedCustomTemplateGuardrail]);

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
      offerArchetype: string;
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
      offerArchetype: previewPayload.offerArchetype,
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
      customTemplateGuardrailFetcher.data?.success &&
      customTemplateGuardrailFetcher.data.intent ===
        "accept_custom_template_guardrail"
    ) {
      setHasAcceptedCustomTemplateGuardrail(true);
      setCustomTemplateGuardrailOpen(false);
      setCustomTemplateGuardrailChecked(false);

      if (pendingCreateAfterGuardrail) {
        setPendingCreateAfterGuardrail(false);
        navigate("/app/licenses?new=1");
      }
    }
  }, [
    customTemplateGuardrailFetcher.data,
    navigate,
    pendingCreateAfterGuardrail,
  ]);

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
    if (!bundleFetcher.data?.success) return;

    if (
      bundleFetcher.data.intent === "create_bundle" ||
      bundleFetcher.data.intent === "update_bundle" ||
      bundleFetcher.data.intent === "add_to_existing_bundles"
    ) {
      setBundleModalOpen(false);
      setAddToBundlesModalOpen(false);
      setBundleModalSearchValue("");
      setBundleSearchValue("");
      setBundleModalShowSelectedOnly(false);
      setBundleShowSelectedOnly(false);
      setSelectedBundleIds([]);
      setEditingBundleId(null);
      clearSelection();
      navigate("/app/licenses", { replace: true });
    }
  }, [bundleFetcher.data, clearSelection, navigate]);

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

  useEffect(() => {
    if (actionData?.requiresCustomTemplateGuardrail) {
      setCustomTemplateGuardrailOpen(true);
    }
  }, [actionData]);

  useEffect(() => {
    if (isCreating && !hasAcceptedCustomTemplateGuardrail) {
      setCustomTemplateGuardrailOpen(true);
    }
  }, [hasAcceptedCustomTemplateGuardrail, isCreating]);

  const handleOpenCreate = useCallback(() => {
    if (!hasAcceptedCustomTemplateGuardrail) {
      setPendingCreateAfterGuardrail(true);
      setCustomTemplateGuardrailChecked(false);
      setCustomTemplateGuardrailOpen(true);
      return;
    }

    navigate("/app/licenses?new=1");
  }, [hasAcceptedCustomTemplateGuardrail, navigate]);

  const handleOpenCreateBundle = useCallback(
    (preselectedLicenseIds: string[] = []) => {
      setBundleModalMode("create");
      setEditingBundleId(null);
      setBundleModalName("");
      setBundleModalSelectedLicenseIds(preselectedLicenseIds);
      setInitialBundleModalName("");
      setInitialBundleModalSelectedLicenseIds(preselectedLicenseIds);
      setBundleModalSearchValue("");
      setBundleModalShowSelectedOnly(false);
      setBundleModalOpen(true);
    },
    [],
  );

  const handleOpenEditBundle = useCallback((bundle: LicenseBundle) => {
    if (bundle.isStarterBundle) {
      return;
    }

    setBundleModalMode("update");
    setEditingBundleId(bundle.id);
    setBundleModalName(bundle.name);
    setBundleModalSelectedLicenseIds(bundle.licenseMetaobjectIds);
    setInitialBundleModalName(bundle.name);
    setInitialBundleModalSelectedLicenseIds(bundle.licenseMetaobjectIds);
    setBundleModalSearchValue("");
    setBundleModalShowSelectedOnly(false);
    setBundleModalOpen(true);
  }, []);

  const handleOpenAddToBundles = useCallback(() => {
    setSelectedBundleIds([]);
    setInitialSelectedBundleIds([]);
    setBundleSearchValue("");
    setBundleShowSelectedOnly(false);
    setAddToBundlesModalOpen(true);
  }, []);

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

  const handleCloseCustomTemplateGuardrail = useCallback(() => {
    setCustomTemplateGuardrailOpen(false);
    setCustomTemplateGuardrailChecked(false);
    setPendingCreateAfterGuardrail(false);

    if (isCreating && !hasAcceptedCustomTemplateGuardrail) {
      navigate("/app/licenses");
    }
  }, [hasAcceptedCustomTemplateGuardrail, isCreating, navigate]);

  const handleCloseBundleModal = useCallback(() => {
    setBundleModalOpen(false);
    setEditingBundleId(null);
    setInitialBundleModalName("");
    setInitialBundleModalSelectedLicenseIds([]);
    setBundleModalSearchValue("");
    setBundleModalShowSelectedOnly(false);
  }, []);

  const handleCloseAddToBundlesModal = useCallback(() => {
    setAddToBundlesModalOpen(false);
    setSelectedBundleIds([]);
    setInitialSelectedBundleIds([]);
    setBundleSearchValue("");
    setBundleShowSelectedOnly(false);
  }, []);

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

  const handleAcceptCustomTemplateGuardrail = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "accept_custom_template_guardrail");
    customTemplateGuardrailFetcher.submit(formData, { method: "post" });
  }, [customTemplateGuardrailFetcher]);

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const handleClearAll = useCallback(() => {
    setQueryValue("");
    setSelectedTableView(0);
  }, []);

  const handleToggleBundleLicense = useCallback((licenseId: string) => {
    setBundleModalSelectedLicenseIds((current) =>
      current.includes(licenseId)
        ? current.filter((id) => id !== licenseId)
        : [...current, licenseId],
    );
  }, []);

  const handleSelectAllVisibleBundleLicenses = useCallback(() => {
    setBundleModalSelectedLicenseIds((current) => {
      const next = new Set(current);
      filteredModalLicenses.forEach((license) => next.add(license.id));
      return [...next];
    });
  }, [filteredModalLicenses]);

  const handleClearAllBundleLicenses = useCallback(() => {
    setBundleModalSelectedLicenseIds([]);
  }, []);

  const handleToggleBundle = useCallback((bundleId: string) => {
    setSelectedBundleIds((current) =>
      current.includes(bundleId)
        ? current.filter((id) => id !== bundleId)
        : [...current, bundleId],
    );
  }, []);

  const handleSelectAllVisibleBundles = useCallback(() => {
    setSelectedBundleIds((current) => {
      const next = new Set(current);
      filteredBundleOptions.forEach((bundle) => next.add(bundle.id));
      return [...next];
    });
  }, [filteredBundleOptions]);

  const handleClearAllBundles = useCallback(() => {
    setSelectedBundleIds([]);
  }, []);

  const handleSubmitBundle = useCallback(() => {
    const selectedLicenses = licensesWithGuardrailState.filter((license) =>
      bundleModalSelectedLicenseIds.includes(license.id),
    );
    const formData = new FormData();
    formData.append(
      "intent",
      bundleModalMode === "update" ? "update_bundle" : "create_bundle",
    );
    formData.append("bundleName", bundleModalName);
    if (editingBundleId) {
      formData.append("bundleId", editingBundleId);
    }

    selectedLicenses.forEach((license) => {
      formData.append("licenseIds", license.id);
      formData.append("licenseHandles", license.handle);
    });

    bundleFetcher.submit(formData, { method: "post" });
  }, [
    bundleFetcher,
    bundleModalMode,
    bundleModalName,
    bundleModalSelectedLicenseIds,
    editingBundleId,
    licensesWithGuardrailState,
  ]);

  const handleSubmitAddToBundles = useCallback(() => {
    const selectedLicenses = filteredLicenses.filter((license) =>
      selectedLicenseIds.includes(license.id),
    );
    const formData = new FormData();
    formData.append("intent", "add_to_existing_bundles");
    selectedBundleIds.forEach((bundleId) => {
      formData.append("bundleIds", bundleId);
    });
    selectedLicenses.forEach((license) => {
      formData.append("licenseIds", license.id);
      formData.append("licenseHandles", license.handle);
    });

    bundleFetcher.submit(formData, { method: "post" });
  }, [bundleFetcher, filteredLicenses, selectedBundleIds, selectedLicenseIds]);

  const handleRightsPopoverToggle = useCallback((templateId: string) => {
    setActiveRightsPopoverId((current) =>
      current === templateId ? null : templateId,
    );
  }, []);

  const handleDeliveryPopoverToggle = useCallback((templateId: string) => {
    setActiveDeliveryPopoverId((current) =>
      current === templateId ? null : templateId,
    );
  }, []);

  const handleUsagePopoverToggle = useCallback((templateId: string) => {
    setActiveUsagePopoverId((current) =>
      current === templateId ? null : templateId,
    );
  }, []);

  const handleSave = useCallback(() => {
    if (editorMode === "create" && !hasAcceptedCustomTemplateGuardrail) {
      setCustomTemplateGuardrailOpen(true);
      return;
    }

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
  }, [
    editorLicense,
    editorMode,
    hasAcceptedCustomTemplateGuardrail,
    licenseForm,
    requiresEditorGuardrail,
    submit,
  ]);

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
    const archetypeConfig = getOfferArchetypeConfig(licenseForm.offerArchetype);
    const limitPresetConfig = getOfferLimitPresetConfig(
      licenseForm.offerArchetype,
    );
    const templateDerivedFields = buildDerivedLicenseFields(
      licenseForm.offerArchetype,
      {
        stemsPolicy: licenseForm.stemsPolicy,
      },
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
              !licenseForm.licenseName.trim() ||
              requiresEditorGuardrail ||
              requiresCreateGuardrail,
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

            {customTemplateGuardrailError && (
              <Layout.Section>
                <Banner title="Unable to record review" tone="critical">
                  <p>{customTemplateGuardrailError}</p>
                </Banner>
              </Layout.Section>
            )}

            {requiresCreateGuardrail ? (
              <Layout.Section>
                <Banner
                  title="Review required before creating a custom template"
                  tone="warning"
                  action={{
                    content: "Review & Accept",
                    onAction: () => setCustomTemplateGuardrailOpen(true),
                  }}
                >
                  <p>
                    You&apos;re creating a reusable template with terms you
                    control. Producer Launchpad can generate and deliver this
                    agreement, but you are responsible for the final language
                    and settings you publish to buyers.
                  </p>
                </Banner>
              </Layout.Section>
            ) : null}

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

                    {editorMode === "create" ? (
                      <Select
                        label="Template type"
                        options={OFFER_ARCHETYPE_OPTIONS}
                        value={licenseForm.offerArchetype}
                        onChange={(value) =>
                          setLicenseForm((current) =>
                            buildArchetypeBoundForm(value, current),
                          )
                        }
                        helpText="Choose the locked offer archetype. This controls the agreement family and base delivery package for the template."
                      />
                    ) : (
                      <TextField
                        label="Template type"
                        value={archetypeConfig.label}
                        autoComplete="off"
                        readOnly
                        helpText="Locked after creation so live storefront offers and delivery packages stay stable across beats already using this template."
                      />
                    )}

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
                      helpText="This name is customer-facing and can be used for storefront marketing. The locked template type still controls the underlying legal rights model."
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
                        Choose from curated caps for this template type so
                        reusable offers stay predictable across beats.
                      </Text>
                    </BlockStack>

                    <FormLayout>
                      <FormLayout.Group>
                        <Select
                          label="Stream limit"
                          options={buildPresetOptions(
                            "streamLimit",
                            limitPresetConfig.streamLimit,
                          )}
                          value={licenseForm.streamLimit}
                          onChange={(value) =>
                            setLicenseForm((current) => ({
                              ...current,
                              streamLimit: value,
                            }))
                          }
                          helpText="Curated stream caps for this archetype. Unlimited templates stay locked to unlimited."
                        />
                        <Select
                          label="Copy limit"
                          options={buildPresetOptions(
                            "copyLimit",
                            limitPresetConfig.copyLimit,
                          )}
                          value={licenseForm.copyLimit}
                          onChange={(value) =>
                            setLicenseForm((current) => ({
                              ...current,
                              copyLimit: value,
                            }))
                          }
                          helpText="Choose the maximum number of copies permitted under this template."
                        />
                      </FormLayout.Group>

                      <Select
                        label="Video view limit"
                        options={buildPresetOptions(
                          "videoViewLimit",
                          limitPresetConfig.videoViewLimit,
                        )}
                        value={licenseForm.videoViewLimit}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            videoViewLimit: value,
                          }))
                        }
                        helpText="Use a preset so storefront copy and agreement previews stay in sync."
                      />

                      <Select
                        label="Term (years)"
                        options={buildPresetOptions(
                          "termYears",
                          limitPresetConfig.termYears,
                        )}
                        value={licenseForm.termYears}
                        onChange={(value) =>
                          setLicenseForm((current) => ({
                            ...current,
                            termYears: value,
                          }))
                        }
                        helpText="Perpetual terms are available only where the archetype allows them."
                      />

                      <Text as="p" tone="subdued">
                        Each template type uses a curated set of caps so
                        storefront copy, agreement previews, and delivery
                        expectations stay aligned.
                      </Text>
                    </FormLayout>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Base package
                      </Text>
                      <Text as="p" tone="subdued">
                        These fields stay fixed so beats already using this
                        template do not drift after you publish them.
                      </Text>
                    </BlockStack>

                    <FormLayout>
                      <TextField
                        label="File formats"
                        value={licenseForm.fileFormats}
                        autoComplete="off"
                        readOnly
                        helpText="Locked to the selected template type so storefront messaging matches what buyers will actually receive."
                      />

                      <TextField
                        label="Agreement family"
                        value={formatTemplateFamilyLabel(
                          licenseForm.legalTemplateFamily,
                        )}
                        autoComplete="off"
                        readOnly
                        helpText="Locked to the selected template type so the legal rights model stays stable across all products using this template."
                      />

                      {licenseForm.offerArchetype === "unlimited" ? (
                        <Checkbox
                          label="Include stems in base package"
                          checked={
                            licenseForm.stemsPolicy === "included_by_default"
                          }
                          helpText="Turn this off if this Unlimited template should sell stems as an optional add-on instead of bundling them into the base package."
                          onChange={(checked) =>
                            setLicenseForm((current) =>
                              buildArchetypeBoundForm(current.offerArchetype, {
                                ...current,
                                stemsPolicy: checked
                                  ? "included_by_default"
                                  : "available_as_addon",
                              }),
                            )
                          }
                        />
                      ) : null}

                      <Text as="p" tone="subdued">
                        {templateDerivedFields.stemsBehaviorLabel}.
                      </Text>

                      <Text as="p" tone="subdued">
                        {templateDerivedFields.stemsBehaviorHelpText}
                      </Text>
                    </FormLayout>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Storefront copy
                      </Text>
                      <Text as="p" tone="subdued">
                        Adjust the customer-facing summary buyers read when they
                        compare offers.
                      </Text>
                    </BlockStack>

                    <FormLayout>
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
                        Agreement settings
                      </Text>
                      <Text as="p" tone="subdued">
                        Choose the controlled options that change the agreement
                        language when Producer Launchpad renders the final
                        document.
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
                      <Badge
                        tone={getTemplateStemsBadgeTone(
                          licenseForm.stemsPolicy,
                        )}
                      >
                        {templateDerivedFields.stemsBehaviorLabel}
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
                    ) : null}

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
                      Fields filled at checkout
                    </Text>
                    <Text as="p" tone="subdued">
                      These variables are filled with store and order data when
                      the agreement is created.
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

        <AcknowledgmentModal
          open={customTemplateGuardrailOpen}
          title="You’re customizing the final license terms"
          primaryActionLabel="I understand"
          secondaryActionLabel="Back"
          checkboxLabel="I understand that custom license terms are my responsibility."
          checkboxChecked={customTemplateGuardrailChecked}
          primaryActionLoading={isAcceptingCustomTemplateGuardrail}
          onCheckboxChange={setCustomTemplateGuardrailChecked}
          onPrimaryAction={handleAcceptCustomTemplateGuardrail}
          onClose={handleCloseCustomTemplateGuardrail}
        >
          <Text as="p" variant="bodyMd">
            This template includes terms you control. Producer Launchpad can
            generate and deliver the agreement, but you are responsible for the
            final language and settings you publish to buyers.
          </Text>
        </AcknowledgmentModal>
      </>
    );
  }

  return (
    <>
      <Page
        fullWidth
        title="Licenses"
        subtitle="Manage reusable license templates and bundle them into faster upload setups."
        primaryAction={{
          content: "Add license",
          onAction: handleOpenCreate,
        }}
        secondaryActions={[
          {
            content: "Create bundle",
            onAction: () => handleOpenCreateBundle(),
          },
        ]}
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

          {customTemplateGuardrailError && (
            <Layout.Section>
              <Banner title="Unable to record review" tone="critical">
                <p>{customTemplateGuardrailError}</p>
              </Banner>
            </Layout.Section>
          )}

          {bundleError && (
            <Layout.Section>
              <Banner title="Unable to update bundle" tone="critical">
                <p>{bundleError}</p>
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

          {bundleFetcher.data?.success && (
            <Layout.Section>
              <Banner
                title={
                  bundleFetcher.data.intent === "create_bundle"
                    ? "Bundle created"
                    : bundleFetcher.data.intent === "update_bundle"
                      ? "Bundle updated"
                      : "Licenses included in bundle"
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
                        No licenses yet
                      </Text>
                      <Text as="p" tone="subdued">
                        Create your first license to define storefront copy,
                        usage limits, and delivery options for new beat offers.
                      </Text>
                      <InlineStack>
                        <Button onClick={handleOpenCreate}>Add license</Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
              ) : (
                <Card padding="0">
                  <IndexFilters
                    queryValue={queryValue}
                    queryPlaceholder={
                      selectedTableView === 0
                        ? "Search licenses"
                        : "Search bundles"
                    }
                    onQueryChange={setQueryValue}
                    onQueryClear={handleQueryValueRemove}
                    cancelAction={{
                      onAction: handleClearAll,
                      disabled:
                        !queryValue &&
                        selectedTableView === 0 &&
                        (sortSelected[0] || "updated desc") === "updated desc",
                      loading: false,
                    }}
                    tabs={tableTabs}
                    selected={selectedTableView}
                    onSelect={(index) => {
                      setSelectedTableView(index);
                      setQueryValue("");
                      clearSelection();
                    }}
                    filters={[]}
                    appliedFilters={[]}
                    onClearAll={handleClearAll}
                    sortOptions={sortOptions}
                    sortSelected={sortSelected}
                    onSort={setSortSelected}
                    mode={mode}
                    setMode={setMode}
                    canCreateNewView={false}
                  />

                  {selectedTableView === 0 ? (
                    <IndexTable
                      selectable
                      resourceName={{ singular: "license", plural: "licenses" }}
                      itemCount={filteredLicenses.length}
                      selectedItemsCount={
                        allResourcesSelected ? "All" : selectedLicenseIds.length
                      }
                      onSelectionChange={handleSelectionChange}
                      promotedBulkActions={[
                        {
                          content: "Include in license bundles",
                          onAction: handleOpenAddToBundles,
                        },
                        {
                          content: "Create new license bundle",
                          onAction: () =>
                            handleOpenCreateBundle(selectedLicenseIds),
                        },
                      ]}
                      headings={[
                        { title: "License" },
                        { title: "Bundle" },
                        { title: "Rights" },
                        { title: "Delivery package" },
                        { title: "Used by" },
                        { title: "Status" },
                        { title: "" },
                      ]}
                    >
                      {filteredLicenses.map((license, index) => {
                        const usage = licenseUsageById[license.id];
                        const status = getLicenseStatus(license, usage);
                        const customTermCount = countCustomTerms(license.terms);
                        const storefrontSummary = parseFeatureLines(
                          license.featuresShort,
                        );
                        const fileBadges = parseFileFormatBadges(
                          license.fileFormats,
                        );
                        const templateDerivedFields = buildDerivedLicenseFields(
                          license.offerArchetype,
                          {
                            stemsPolicy: license.stemsPolicy,
                          },
                        );
                        const bundleSummary = buildBundleMembershipSummary(
                          bundleNamesByLicenseId.get(license.id) ?? [],
                        );

                        return (
                          <IndexTable.Row
                            key={license.id}
                            id={license.id}
                            position={index}
                            selected={selectedLicenseIds.includes(license.id)}
                          >
                            <IndexTable.Cell>
                              <Text
                                as="span"
                                variant="bodyMd"
                                fontWeight="semibold"
                              >
                                {license.licenseName}
                              </Text>
                            </IndexTable.Cell>

                            <IndexTable.Cell>
                              <BlockStack gap="050">
                                <Text as="p">{bundleSummary.primary}</Text>
                                {bundleSummary.secondary.length > 0 ? (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    +{bundleSummary.secondary.length} more
                                  </Text>
                                ) : null}
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
                                    <Text
                                      as="p"
                                      variant="headingSm"
                                      fontWeight="semibold"
                                    >
                                      Usage boundaries
                                    </Text>
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
                                      <Badge
                                        tone={getTemplateStemsBadgeTone(
                                          license.stemsPolicy,
                                        )}
                                      >
                                        {templateDerivedFields.stemsBehaviorLabel}
                                      </Badge>
                                    </InlineStack>

                                    <Text as="p" tone="subdued">
                                      {
                                        templateDerivedFields.stemsBehaviorHelpText
                                      }
                                    </Text>

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
                                      ? pluralize(usage.beatCount, "beat")
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
                                      Beats using this license
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
                                        Assign this license to beats from the
                                        upload or beat editing flow.
                                      </Text>
                                    )}
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
                                    ? "This license is complete and already used by beats in your catalog."
                                    : status.label === "Unused"
                                      ? "This license is ready, but no beats reference it yet."
                                      : "Add core package details before using this license on beats."
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
                  ) : filteredBundles.length === 0 ? (
                    <Card>
                      <EmptyState
                        heading="No bundles yet"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>
                          Create a bundle to save a reusable set of licenses
                          for faster beat uploads.
                        </p>
                        <Button onClick={() => handleOpenCreateBundle()}>
                          Create bundle
                        </Button>
                      </EmptyState>
                    </Card>
                  ) : (
                    <IndexTable
                      selectable={false}
                      resourceName={{ singular: "bundle", plural: "bundles" }}
                      itemCount={filteredBundles.length}
                      headings={[
                        { title: "Bundle" },
                        { title: "Included licenses" },
                        { title: "Default" },
                        { title: "Updated" },
                        { title: "" },
                      ]}
                    >
                      {filteredBundles.map((bundle, index) => (
                        <IndexTable.Row
                          key={bundle.id}
                          id={bundle.id}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <Text
                              as="span"
                              variant="bodyMd"
                              fontWeight="semibold"
                            >
                              {bundle.name}
                            </Text>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <BlockStack gap="050">
                              <Text as="p">
                                {pluralize(bundle.licenseNames.length, "license")}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {bundle.licenseNames.slice(0, 3).join(", ") ||
                                  "No licenses yet"}
                              </Text>
                            </BlockStack>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            {bundle.isDefault ? (
                              <Badge tone="success">Default</Badge>
                            ) : (
                              <Text as="span" tone="subdued">
                                -
                              </Text>
                            )}
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            <Text as="span" tone="subdued">
                              {new Date(bundle.updatedAt).toLocaleDateString()}
                            </Text>
                          </IndexTable.Cell>

                          <IndexTable.Cell>
                            {bundle.isStarterBundle ? (
                              <Text as="span" tone="subdued">
                                Included by default
                              </Text>
                            ) : (
                              <Button
                                variant="plain"
                                onClick={() => handleOpenEditBundle(bundle)}
                              >
                                Edit
                              </Button>
                            )}
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>

      <SelectableListModal
        open={addToBundlesModalOpen}
        title={
          selectedLicenseCount > 0
            ? `Include ${selectedLicenseLabel} in license bundles`
            : "Include in license bundles"
        }
        resourceLabel="License bundles"
        searchValue={bundleSearchValue}
        searchPlaceholder="Search bundles"
        showSelectedOnly={bundleShowSelectedOnly}
        items={bundleOptionItems}
        selectedIds={selectedBundleIds}
        primaryActionLabel={
          selectedLicenseCount === 1 ? "Add license" : "Add licenses"
        }
        primaryActionLoading={
          bundleFetcher.state !== "idle" &&
          bundleFetcher.formData?.get("intent") === "add_to_existing_bundles"
        }
        primaryActionDisabled={
          selectedBundleIds.length === 0 ||
          selectedLicenseCount === 0 ||
          !hasCustomBundles
        }
        emptyStateTitle={
          hasCustomBundles ? "No bundles match" : "No bundles available"
        }
        emptyStateBody={
          hasCustomBundles
            ? "Try a different search or turn off Show all selected."
            : "Create a bundle first, then include these licenses in it."
        }
        hasUnsavedChanges={hasAddToBundlesUnsavedChanges}
        onSearchChange={setBundleSearchValue}
        onShowSelectedOnlyChange={setBundleShowSelectedOnly}
        onToggleItem={handleToggleBundle}
        onSelectAllVisible={handleSelectAllVisibleBundles}
        onClearAllSelected={handleClearAllBundles}
        onPrimaryAction={handleSubmitAddToBundles}
        onClose={handleCloseAddToBundlesModal}
      />

      <SelectableListModal
        open={bundleModalOpen}
        title={
          bundleModalMode === "update"
            ? "Edit license bundle"
            : bundleModalSelectedLicenseIds.length > 0
              ? `Create license bundle from ${pluralize(
                  bundleModalSelectedLicenseIds.length,
                  "license",
                )}`
              : "Create license bundle"
        }
        resourceLabel="Licenses"
        searchValue={bundleModalSearchValue}
        searchPlaceholder="Search licenses"
        showSelectedOnly={bundleModalShowSelectedOnly}
        items={bundleModalItems}
        selectedIds={bundleModalSelectedLicenseIds}
        primaryActionLabel={
          bundleModalMode === "update" ? "Save bundle" : "Create bundle"
        }
        primaryActionLoading={
          bundleFetcher.state !== "idle" &&
          (bundleFetcher.formData?.get("intent") === "create_bundle" ||
            bundleFetcher.formData?.get("intent") === "update_bundle")
        }
        primaryActionDisabled={
          !bundleModalName.trim() || bundleModalSelectedLicenseIds.length === 0
        }
        emptyStateTitle="No licenses match"
        emptyStateBody="Try a different search or turn off Show all selected."
        hasUnsavedChanges={hasBundleModalUnsavedChanges}
        onSearchChange={setBundleModalSearchValue}
        onShowSelectedOnlyChange={setBundleModalShowSelectedOnly}
        onToggleItem={handleToggleBundleLicense}
        onSelectAllVisible={handleSelectAllVisibleBundleLicenses}
        onClearAllSelected={handleClearAllBundleLicenses}
        onPrimaryAction={handleSubmitBundle}
        onClose={handleCloseBundleModal}
      >
        <TextField
          label="Bundle name"
          value={bundleModalName}
          onChange={setBundleModalName}
          autoComplete="off"
        />
      </SelectableListModal>

      <LegalGuardrailModal
        open={Boolean(guardrailModalTemplate)}
        templateName={guardrailModalTemplate?.licenseName || "Starter Preset"}
        accepting={isAcceptingGuardrail}
        onAccept={handleAcceptGuardrail}
        onClose={handleCloseGuardrailModal}
      />

      <AcknowledgmentModal
        open={customTemplateGuardrailOpen}
        title="Custom license acknowledgment"
        primaryActionLabel="I understand, continue"
        secondaryActionLabel="Back"
        checkboxLabel="I understand I’ll review and finalize the full terms before using this license with buyers."
        checkboxChecked={customTemplateGuardrailChecked}
        primaryActionLoading={isAcceptingCustomTemplateGuardrail}
        onCheckboxChange={setCustomTemplateGuardrailChecked}
        onPrimaryAction={handleAcceptCustomTemplateGuardrail}
        onClose={handleCloseCustomTemplateGuardrail}
      >
        <Text as="p" variant="bodyMd">
          You&apos;re creating a custom license template. Before using it with
          buyers, review and finalize the full terms to fit your business.
          Producer Launchpad is not a law firm or legal advisor, so the final
          terms remain your responsibility.
        </Text>
      </AcknowledgmentModal>
    </>
  );
}
