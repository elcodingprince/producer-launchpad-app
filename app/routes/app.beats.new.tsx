import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import {
  Page,
  Layout,
  Banner,
  Card,
  BlockStack,
  Box,
  Checkbox,
  TextField,
  Select,
  Text,
  Icon,
  FormLayout,
  Badge,
  InlineStack,
  Modal,
  Scrollable,
} from "@shopify/polaris";
import { AlertCircleIcon } from "@shopify/polaris-icons";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { AcknowledgmentModal } from "~/components/AcknowledgmentModal";
import { createProductCreatorService } from "../services/productCreator";
import { getAppReadiness } from "~/services/appReadiness.server";
import {
  acceptMerchantAcknowledgment,
  hasMerchantAcknowledged,
  MERCHANT_ACKNOWLEDGMENT_KEYS,
  normalizeSessionUserId,
} from "~/services/merchantAcknowledgments.server";
import {
  formatDeliveryFormatLabel,
  getRequiredDeliveryFormats,
  licenseOffersStems,
  normalizeDeliveryFormat,
  resolveOfferStemsPolicy,
  type DeliveryFormat,
} from "~/services/deliveryPackages";
import {
  getStorageConfigForDisplay,
  shouldHardBlockUpload,
  shouldSoftWarnUpload,
} from "~/services/storageConfig.server";
import {
  uploadDynamicFilesForShop,
  type DynamicFileUpload,
  type UploadedFileResult,
} from "~/services/storageUpload.server";
import {
  LicenseFileAssignment,
  type LicenseOfferGroup,
  type UploadedFile,
  type LicenseFiles,
  type StemsAddonSelections,
} from "../components/LicenseFileAssignment";
import { MultiSelectCombobox } from "../components/MultiSelectCombobox";
import { ProductTagsField } from "../components/ProductTagsField";

type UploadLicense = {
  id: string;
  handle: string;
  offerArchetype: string;
  licenseName: string;
  displayName: string;
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
};

type UploadLicenseBundle = {
  id: string;
  name: string;
  isDefault: boolean;
  isStarterBundle: boolean;
  licenseMetaobjectIds: string[];
  licenseHandles: string[];
  resolvedLicenseMetaobjectIds: string[];
  licenseNames: string[];
  missingLicenseCount: number;
  missingLicenseHandles: string[];
  updatedAt: string;
};

type LicenseSelectionState = {
  selectedBundleIds: string[];
  selectedLicenseIds: string[];
  bundleLicenseOverrides?: Record<string, string[]>;
};

type UploadValidationErrors = {
  title?: string;
  bpm?: string;
  key?: string;
  genreGids?: string;
  producerGids?: string;
  previewFile?: string;
  selectedOffers?: string;
  priceByLicenseId: Record<string, string>;
  deliveryByLicenseId: Record<string, string>;
  bannerMessages: string[];
};

const STARTER_BUNDLE_ID = "starter-preset-bundle";
const STARTER_BUNDLE_NAME = "Starter Preset";
const STARTER_LICENSE_HANDLES = [
  "basic-license",
  "premium-license",
  "unlimited-license",
] as const;
const STARTER_LICENSE_HANDLE_SET = new Set<string>(STARTER_LICENSE_HANDLES);

const keyOptions = [
  "C major",
  "C minor",
  "C# major",
  "C# minor",
  "D major",
  "D minor",
  "D# major",
  "D# minor",
  "E major",
  "E minor",
  "F major",
  "F minor",
  "F# major",
  "F# minor",
  "G major",
  "G minor",
  "G# major",
  "G# minor",
  "A major",
  "A minor",
  "A# major",
  "A# minor",
  "B major",
  "B minor",
];

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function hasCompleteLicensePrices(
  licenses: Array<{ id: string }>,
  licensePrices: Record<string, string>,
) {
  return licenses.every((license) => {
    const rawPrice = licensePrices[license.id];
    if (rawPrice == null || rawPrice.trim() === "") return false;
    const parsed = Number.parseFloat(rawPrice);
    return Number.isFinite(parsed) && parsed > 0;
  });
}

function getLegacyLicenseKey(license: {
  offerArchetype?: string | null;
  handle?: string | null;
}) {
  return license.offerArchetype || license.handle || "";
}

function readTemplateScopedValue<T>(
  record: Record<string, T>,
  license: {
    id: string;
    offerArchetype?: string | null;
    handle?: string | null;
  },
): T | undefined {
  if (license.id in record) return record[license.id];

  const legacyKey = getLegacyLicenseKey(license);
  if (legacyKey && legacyKey in record) return record[legacyKey];

  return undefined;
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeProductTag(tag: string) {
  return tag.replace(/\s+/g, " ").trim().replace(/^,+|,+$/g, "");
}

function normalizeProductTags(tags: string[]) {
  const seen = new Set<string>();

  return tags.reduce<string[]>((result, tag) => {
    const normalizedTag = normalizeProductTag(tag);
    if (!normalizedTag) return result;

    const dedupeKey = normalizedTag.toLowerCase();
    if (seen.has(dedupeKey)) return result;

    seen.add(dedupeKey);
    result.push(normalizedTag);
    return result;
  }, []);
}

function dedupeFilesById(files: Array<UploadedFile | null | undefined>) {
  const byId = new Map<string, UploadedFile>();
  for (const file of files) {
    if (file?.id) {
      byId.set(file.id, file);
    }
  }
  return Array.from(byId.values());
}

function serializeUploadedFile(file: UploadedFile | null) {
  if (!file) return null;
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    purpose: file.purpose,
    size: file.size,
    storageUrl: file.storageUrl || null,
    storageKey: file.storageKey || null,
    shopifyResourceUrl: file.shopifyResourceUrl || null,
  };
}

function serializeUploadedFiles(files: UploadedFile[]) {
  return files.map((file) => serializeUploadedFile(file));
}

function isLicenseDeliveryFile(file: UploadedFile) {
  return (
    file.purpose === "mp3" || file.purpose === "wav" || file.purpose === "stems"
  );
}

function hasSharedStemsSourceFile(
  files: Array<Pick<UploadedFile, "purpose" | "type">>,
) {
  return files.some(
    (file) =>
      normalizeDeliveryFormat(file.purpose || file.type || "") === "stems",
  );
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function createEmptyUploadValidationErrors(): UploadValidationErrors {
  return {
    priceByLicenseId: {},
    deliveryByLicenseId: {},
    bannerMessages: [],
  };
}

function getTitleValidationError(title: string) {
  return title.trim() ? undefined : "Title can't be blank";
}

function getUploadValidationErrors({
  title,
  bpm,
  key,
  genreGids,
  producerGids,
  previewFile,
  selectedLicenses,
  uploadedFiles,
  licenseFiles,
  licensePrices,
  stemsAddonSelections,
}: {
  title: string;
  bpm: string | number;
  key: string;
  genreGids: string[];
  producerGids: string[];
  previewFile: UploadedFile | null;
  selectedLicenses: Array<
    Pick<
      UploadLicense,
      "id" | "licenseName" | "stemsPolicy" | "offerArchetype" | "fileFormats"
    >
  >;
  uploadedFiles: UploadedFile[];
  licenseFiles: LicenseFiles;
  licensePrices: Record<string, string>;
  stemsAddonSelections: StemsAddonSelections;
}): UploadValidationErrors {
  const errors = createEmptyUploadValidationErrors();

  const parsedBpm =
    typeof bpm === "number" ? bpm : Number.parseInt(String(bpm), 10);
  const hasSharedStems = hasSharedStemsSourceFile(uploadedFiles);

  errors.title = getTitleValidationError(title);
  if (errors.title) errors.bannerMessages.push(errors.title);

  if (!Number.isFinite(parsedBpm) || parsedBpm <= 0) {
    errors.bpm = "Add BPM";
    errors.bannerMessages.push("Add BPM.");
  }

  if (!key.trim()) {
    errors.key = "Choose a key";
    errors.bannerMessages.push("Choose a key.");
  }

  if (genreGids.length === 0) {
    errors.genreGids = "Choose at least one genre";
    errors.bannerMessages.push("Choose at least one genre.");
  }

  if (producerGids.length === 0) {
    errors.producerGids = "Choose at least one producer";
    errors.bannerMessages.push("Choose at least one producer.");
  }

  if (!previewFile) {
    errors.previewFile = "Upload a preview MP3";
    errors.bannerMessages.push("Upload a preview MP3.");
  }

  if (selectedLicenses.length === 0) {
    errors.selectedOffers = "Choose at least one license offer";
    errors.bannerMessages.push("Choose at least one license offer.");
  }

  selectedLicenses.forEach((license) => {
    const rawPrice = licensePrices[license.id];
    const parsedPrice = Number.parseFloat(String(rawPrice || ""));
    if (!rawPrice || rawPrice.trim() === "" || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      errors.priceByLicenseId[license.id] = "Add a price";
    }

    const assignedFiles = (licenseFiles[license.id] || [])
      .map((fileId) => uploadedFiles.find((file) => file.id === fileId))
      .filter((file): file is UploadedFile => Boolean(file));
    const assignedFormats = new Set(
      assignedFiles
        .map((file) => normalizeDeliveryFormat(file.purpose || file.type || ""))
        .filter((format): format is DeliveryFormat => Boolean(format)),
    );
    const missingFormats = getRequiredDeliveryFormats(license).filter(
      (format) => !assignedFormats.has(format),
    );

    const offersStems = licenseOffersStems(
      resolveOfferStemsPolicy(
        license.stemsPolicy,
        stemsAddonSelections[license.id],
        license.offerArchetype,
      ),
    );

    const deliveryMessages: string[] = [];
    if (missingFormats.length > 0) {
      deliveryMessages.push(
        `Missing ${missingFormats.map(formatDeliveryFormatLabel).join(", ")}`,
      );
    }
    if (offersStems && !hasSharedStems) {
      deliveryMessages.push("Upload one stems ZIP");
    }

    if (deliveryMessages.length > 0) {
      errors.deliveryByLicenseId[license.id] = deliveryMessages.join(". ");
    }
  });

  if (Object.keys(errors.priceByLicenseId).length > 0) {
    errors.bannerMessages.push("Add a price for each selected license offer.");
  }

  if (Object.keys(errors.deliveryByLicenseId).length > 0) {
    errors.bannerMessages.push(
      "Upload the required delivery files for each selected license offer.",
    );
  }

  errors.bannerMessages = dedupeIds(errors.bannerMessages);

  return errors;
}

function hasUploadValidationErrors(errors: UploadValidationErrors) {
  return Boolean(
    errors.title ||
      errors.bpm ||
      errors.key ||
      errors.genreGids ||
      errors.producerGids ||
      errors.previewFile ||
      errors.selectedOffers ||
      Object.keys(errors.priceByLicenseId).length > 0 ||
      Object.keys(errors.deliveryByLicenseId).length > 0,
  );
}

function orderLicensesByIds<T extends { id: string }>(
  licenses: T[],
  orderedIds: string[],
): T[] {
  const licensesById = new Map(licenses.map((license) => [license.id, license]));
  return orderedIds
    .map((id) => licensesById.get(id))
    .filter((license): license is T => Boolean(license));
}

function buildStarterBundle(licenses: UploadLicense[]): UploadLicenseBundle {
  const licensesByHandle = new Map(
    licenses.map((license) => [license.handle, license]),
  );
  const starterLicenses = STARTER_LICENSE_HANDLES.map((handle) =>
    licensesByHandle.get(handle),
  ).filter((license): license is UploadLicense => Boolean(license));

  return {
    id: STARTER_BUNDLE_ID,
    name: STARTER_BUNDLE_NAME,
    isDefault: true,
    isStarterBundle: true,
    licenseMetaobjectIds: starterLicenses.map((license) => license.id),
    licenseHandles: starterLicenses.map((license) => license.handle),
    resolvedLicenseMetaobjectIds: starterLicenses.map((license) => license.id),
    licenseNames: starterLicenses.map((license) => license.licenseName),
    missingLicenseCount: 0,
    missingLicenseHandles: [],
    updatedAt: new Date().toISOString(),
  };
}

function buildDefaultSelectionState(): LicenseSelectionState {
  return {
    selectedBundleIds: [],
    selectedLicenseIds: [],
    bundleLicenseOverrides: {},
  };
}

function getBundleActiveLicenseIds(
  bundle: UploadLicenseBundle,
  licenses: UploadLicense[],
) {
  const licensesById = new Map(licenses.map((license) => [license.id, license]));
  const licensesByHandle = new Map(
    licenses.map((license) => [license.handle, license]),
  );

  const resolvedById = bundle.resolvedLicenseMetaobjectIds
    .map((licenseId) => licensesById.get(licenseId)?.id || null)
    .filter((licenseId): licenseId is string => Boolean(licenseId));

  if (resolvedById.length > 0) {
    return dedupeIds(resolvedById);
  }

  return dedupeIds(
    bundle.licenseHandles
      .map((licenseHandle) => licensesByHandle.get(licenseHandle)?.id || null)
      .filter((licenseId): licenseId is string => Boolean(licenseId)),
  );
}

function sanitizeLicenseSelectionState(
  selectionState: LicenseSelectionState | null | undefined,
  bundles: UploadLicenseBundle[],
  licenses: UploadLicense[],
): LicenseSelectionState {
  const defaultState = buildDefaultSelectionState();
  const availableBundleIds = new Set(bundles.map((bundle) => bundle.id));
  const availableLicenseIds = new Set(licenses.map((license) => license.id));
  const normalizedSelectedBundleIds = dedupeIds(
    selectionState?.selectedBundleIds || [],
  ).filter((id) => availableBundleIds.has(id));
  const normalizedSelectedLicenseIds = dedupeIds(
    selectionState?.selectedLicenseIds || [],
  ).filter((id) => availableLicenseIds.has(id));
  const incomingOverrides = selectionState?.bundleLicenseOverrides || {};
  const normalizedBundleLicenseOverrides: Record<string, string[]> = {};

  normalizedSelectedBundleIds.forEach((bundleId) => {
    const bundle = bundles.find((candidate) => candidate.id === bundleId);
    if (!bundle) return;

    const availableBundleLicenseIds = getBundleActiveLicenseIds(bundle, licenses);
    const normalizedOverride = dedupeIds(
      incomingOverrides[bundleId] || availableBundleLicenseIds,
    ).filter((licenseId) => availableBundleLicenseIds.includes(licenseId));

    if (
      !arraysEqual(
        [...normalizedOverride].sort(),
        [...availableBundleLicenseIds].sort(),
      )
    ) {
      normalizedBundleLicenseOverrides[bundleId] = normalizedOverride;
    }
  });

  if (
    normalizedSelectedBundleIds.length === 0 &&
    normalizedSelectedLicenseIds.length === 0
  ) {
    return defaultState;
  }

  return {
    selectedBundleIds: normalizedSelectedBundleIds,
    selectedLicenseIds: normalizedSelectedLicenseIds,
    bundleLicenseOverrides: normalizedBundleLicenseOverrides,
  };
}

async function persistLastUsedOfferSelection(
  shop: string,
  selectionState: LicenseSelectionState,
) {
  const delegate = (prisma as unknown as {
    shopUploadPreference?: {
      upsert: (args: {
        where: { shop: string };
        update: { lastUsedOfferSelectionJson: string };
        create: { shop: string; lastUsedOfferSelectionJson: string };
      }) => Promise<unknown>;
    };
  }).shopUploadPreference;

  if (!delegate?.upsert) {
    return;
  }

  try {
    await delegate.upsert({
      where: { shop },
      update: {
        lastUsedOfferSelectionJson: JSON.stringify({
          selectedBundleIds: dedupeIds(selectionState.selectedBundleIds || []),
          selectedLicenseIds: dedupeIds(selectionState.selectedLicenseIds || []),
          bundleLicenseOverrides: selectionState.bundleLicenseOverrides || {},
        } satisfies LicenseSelectionState),
      },
      create: {
        shop,
        lastUsedOfferSelectionJson: JSON.stringify({
          selectedBundleIds: dedupeIds(selectionState.selectedBundleIds || []),
          selectedLicenseIds: dedupeIds(selectionState.selectedLicenseIds || []),
          bundleLicenseOverrides: selectionState.bundleLicenseOverrides || {},
        } satisfies LicenseSelectionState),
      },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
  }
}

function resolveSelectedLicenses(
  selectionState: LicenseSelectionState,
  bundles: UploadLicenseBundle[],
  licenses: UploadLicense[],
): UploadLicense[] {
  const orderedIds: string[] = [];
  const selectedBundleSet = new Set(selectionState.selectedBundleIds);
  const licensesById = new Map(licenses.map((license) => [license.id, license]));

  bundles.forEach((bundle) => {
    if (!selectedBundleSet.has(bundle.id)) return;
    const resolvedBundleLicenseIds = (
      selectionState.bundleLicenseOverrides?.[bundle.id] ||
      getBundleActiveLicenseIds(bundle, licenses)
    )
      .map((licenseId) => licensesById.get(licenseId)?.id || null)
      .filter((licenseId): licenseId is string => Boolean(licenseId));

    resolvedBundleLicenseIds
      .forEach((licenseId) => {
        if (!orderedIds.includes(licenseId)) {
          orderedIds.push(licenseId);
        }
      });
  });

  licenses.forEach((license) => {
    if (
      selectionState.selectedLicenseIds.includes(license.id) &&
      !orderedIds.includes(license.id)
    ) {
      orderedIds.push(license.id);
    }
  });

  return orderLicensesByIds(licenses, orderedIds);
}

function resolveBundleItemLicense(
  licenses: UploadLicense[],
  item: { licenseMetaobjectId: string; licenseHandle: string },
) {
  return (
    licenses.find((license) => license.id === item.licenseMetaobjectId) ||
    licenses.find((license) => license.handle === item.licenseHandle) ||
    null
  );
}

function buildAutomaticLicenseAssignments(
  licenses: UploadLicense[],
  files: UploadedFile[],
  existingAssignments: LicenseFiles,
): LicenseFiles {
  const latestByFormat = new Map<DeliveryFormat, string>();

  files.forEach((file) => {
    const normalizedFormat = normalizeDeliveryFormat(file.purpose || file.type);
    if (normalizedFormat) {
      latestByFormat.set(normalizedFormat, file.id);
    }
  });

  const nextAssignments: LicenseFiles = { ...existingAssignments };

  licenses.forEach((license) => {
    nextAssignments[license.id] = getRequiredDeliveryFormats(license)
      .map((format) => latestByFormat.get(format))
      .filter((fileId): fileId is string => Boolean(fileId));
  });

  return nextAssignments;
}

type UploadActionData = {
  success: boolean;
  intent?: string;
  error?: string;
  redirectTo?: string;
  requiresUploadGuardrail?: boolean;
};

type BeatDraftCompatRecord = {
  id: string;
  shop: string;
  title: string;
  bpm: number | null;
  key: string | null;
  producerAlias: string | null;
  tagsJson?: string | null;
  genreGidsJson: string;
  producerGidsJson: string;
  licenseFilesJson: string;
  licensePricesJson: string;
  stemsAddonSelectionsJson: string;
  selectionStateJson?: string | null;
  uploadedFilesJson: string;
  previewFileJson: string | null;
  coverArtFileJson: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function isSchemaMismatchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist in the current database") ||
    message.includes("does not exist") ||
    message.includes("Unknown argument") ||
    message.includes("Unknown field")
  );
}

async function findBeatDraftByIdCompat(id: string, shop: string) {
  try {
    return (await prisma.beatDraft.findFirst({
      where: { id, shop },
    })) as BeatDraftCompatRecord | null;
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;

    return (await prisma.beatDraft.findFirst({
      where: { id, shop },
      select: {
        id: true,
        shop: true,
        title: true,
        bpm: true,
        key: true,
        producerAlias: true,
        genreGidsJson: true,
        producerGidsJson: true,
        licenseFilesJson: true,
        licensePricesJson: true,
        stemsAddonSelectionsJson: true,
        uploadedFilesJson: true,
        previewFileJson: true,
        coverArtFileJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as BeatDraftCompatRecord | null;
  }
}

async function saveBeatDraftCompat(input: {
  existingDraftId?: string;
  data: {
    shop: string;
    title: string;
    bpm: number | null;
    key: string | null;
    producerAlias: string | null;
    tagsJson: string;
    genreGidsJson: string;
    producerGidsJson: string;
    licenseFilesJson: string;
    licensePricesJson: string;
    stemsAddonSelectionsJson: string;
    selectionStateJson: string;
    uploadedFilesJson: string;
    previewFileJson: string | null;
    coverArtFileJson: string | null;
  };
}) {
  try {
    if (input.existingDraftId) {
      return await prisma.beatDraft.update({
        where: { id: input.existingDraftId },
        data: input.data,
      });
    }

    return await prisma.beatDraft.create({
      data: input.data,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;

    const {
      selectionStateJson: _selectionStateJson,
      tagsJson: _tagsJson,
      ...legacyData
    } = input.data;

    if (input.existingDraftId) {
      return await prisma.beatDraft.update({
        where: { id: input.existingDraftId },
        data: legacyData,
      });
    }

    return await prisma.beatDraft.create({
      data: legacyData,
    });
  }
}

async function getLastUsedOfferSelectionCompat(shop: string) {
  const delegate = (prisma as unknown as {
    shopUploadPreference?: {
      findUnique: (args: { where: { shop: string } }) => Promise<{
        lastUsedOfferSelectionJson: string;
      } | null>;
    };
  }).shopUploadPreference;

  if (!delegate?.findUnique) {
    return null;
  }

  try {
    return await delegate.findUnique({
      where: { shop },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    return null;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const productService = createProductCreatorService(session, admin);
  const url = new URL(request.url);
  const draftId = url.searchParams.get("draft");

  try {
    const readiness = await getAppReadiness(session, admin);
    const storageConfig = readiness.storageConfig;

    if (readiness.needsProfile || readiness.needsCoreSetup) {
      return redirect(readiness.onboardingRoute);
    }

    if (shouldHardBlockUpload(storageConfig)) {
      return redirect(readiness.settingsRoute);
    }

    // Load upload dependencies
    const [
      licenseMetaobjects,
      genres,
      producers,
      bundleRecords,
      shopUploadPreference,
    ] = await Promise.all([
      productService.getLicenseMetaobjects(),
      productService.getGenreMetaobjects(),
      productService.getProducerMetaobjects(),
      prisma.licenseBundle.findMany({
        where: { shop: session.shop },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      getLastUsedOfferSelectionCompat(session.shop),
    ]);

    if (producers.length === 0) {
      return redirect(readiness.onboardingRoute);
    }

    const licenses: UploadLicense[] = licenseMetaobjects
      .map((license) => ({
        ...license,
        isStarter: STARTER_LICENSE_HANDLE_SET.has(license.handle),
      }))
      .sort((left, right) => {
        if (left.isStarter !== right.isStarter) return left.isStarter ? -1 : 1;
        return left.licenseName.localeCompare(right.licenseName);
      });

    const starterBundle = buildStarterBundle(licenses);
    const customBundles: UploadLicenseBundle[] = bundleRecords.map(
      (bundle: {
        id: string;
        name: string;
        isDefault: boolean;
        updatedAt: Date;
        items: Array<{
          licenseMetaobjectId: string;
          licenseHandle: string;
        }>;
      }) => {
        const resolvedLicenses = bundle.items
          .map((item) => resolveBundleItemLicense(licenses, item))
          .filter((license): license is UploadLicense => Boolean(license));
        const missingBundleItems = bundle.items.filter(
          (item) => !resolveBundleItemLicense(licenses, item),
        );

        return {
          id: bundle.id,
          name: bundle.name,
          isDefault: bundle.isDefault,
          isStarterBundle: false,
          licenseMetaobjectIds: bundle.items.map(
            (item: { licenseMetaobjectId: string }) => item.licenseMetaobjectId,
          ),
          licenseHandles: bundle.items.map(
            (item: { licenseHandle: string }) => item.licenseHandle,
          ),
          resolvedLicenseMetaobjectIds: resolvedLicenses.map(
            (license) => license.id,
          ),
          licenseNames: resolvedLicenses.map((license) => license.licenseName),
          missingLicenseCount: missingBundleItems.length,
          missingLicenseHandles: missingBundleItems.map(
            (item) => item.licenseHandle,
          ),
          updatedAt: bundle.updatedAt.toISOString(),
        };
      },
    );
    const bundles = [starterBundle, ...customBundles];

    const hasAcceptedUploadGuardrail = await hasMerchantAcknowledged(
      session.shop,
      MERCHANT_ACKNOWLEDGMENT_KEYS.uploadLicensePublishing,
    );

    const draftRecord = draftId
      ? await findBeatDraftByIdCompat(draftId, session.shop)
      : null;

    return json({
      licenses,
      bundles,
      lastUsedSelectionState: sanitizeLicenseSelectionState(
        parseJsonField<LicenseSelectionState>(
          shopUploadPreference?.lastUsedOfferSelectionJson,
          buildDefaultSelectionState(),
        ),
        bundles,
        licenses,
      ),
      genres,
      producers,
      requiresUploadGuardrail: !hasAcceptedUploadGuardrail,
      draft: draftRecord
        ? {
            id: draftRecord.id,
            title: draftRecord.title,
            bpm: draftRecord.bpm ? String(draftRecord.bpm) : "",
            key: draftRecord.key || "C minor",
            producerAlias: draftRecord.producerAlias || "",
            tags: normalizeProductTags(
              parseJsonField<string[]>(draftRecord.tagsJson, []),
            ),
            genreGids: parseJsonField<string[]>(draftRecord.genreGidsJson, []),
            producerGids: parseJsonField<string[]>(
              draftRecord.producerGidsJson,
              [],
            ),
            licenseFiles: parseJsonField<LicenseFiles>(
              draftRecord.licenseFilesJson,
              {},
            ),
            licensePrices: parseJsonField<Record<string, string>>(
              draftRecord.licensePricesJson,
              {},
            ),
            stemsAddonSelections: parseJsonField<StemsAddonSelections>(
              draftRecord.stemsAddonSelectionsJson,
              {},
            ),
            selectionState: sanitizeLicenseSelectionState(
              parseJsonField<LicenseSelectionState>(
                draftRecord.selectionStateJson,
                buildDefaultSelectionState(),
              ),
              bundles,
              licenses,
            ),
            uploadedFiles: parseJsonField<UploadedFile[]>(
              draftRecord.uploadedFilesJson,
              [],
            ),
            previewFile: parseJsonField<UploadedFile | null>(
              draftRecord.previewFileJson,
              null,
            ),
            coverArtFile: parseJsonField<UploadedFile | null>(
              draftRecord.coverArtFileJson,
              null,
            ),
          }
        : null,
      storageWarning: shouldSoftWarnUpload(storageConfig)
        ? storageConfig?.lastError || "Storage is currently in an error state."
        : null,
      error: null,
    });
  } catch (error) {
    console.error("Upload page loader error:", error);
    return json(
      {
        licenses: [],
        bundles: [] as UploadLicenseBundle[],
        lastUsedSelectionState: buildDefaultSelectionState(),
        genres: [],
        producers: [],
        requiresUploadGuardrail: false,
        draft: null,
        storageWarning: null,
        error:
          error instanceof Error ? error.message : "Failed to load upload page",
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const storageConfig = await getStorageConfigForDisplay(session.shop);
  const sessionUserId = normalizeSessionUserId(
    (session as { userId?: unknown }).userId,
  );
  const sessionEmail =
    typeof (session as { email?: unknown }).email === "string"
      ? (session as { email?: string }).email || null
      : null;

  if (shouldHardBlockUpload(storageConfig)) {
    return redirect("/app/settings");
  }

  try {
    console.info("[upload] started");
    const productService = createProductCreatorService(session, admin);
    const formData = await request.formData();
    const intent = String(formData.get("intent") || "submit_upload");

    if (intent === "accept_upload_guardrail") {
      await acceptMerchantAcknowledgment({
        shop: session.shop,
        acknowledgment: MERCHANT_ACKNOWLEDGMENT_KEYS.uploadLicensePublishing,
        acceptedByUserId: sessionUserId,
        acceptedByEmail: sessionEmail,
      });

      return json({
        success: true,
        intent,
      } satisfies UploadActionData);
    }

    const hasAcceptedUploadGuardrail = await hasMerchantAcknowledged(
      session.shop,
      MERCHANT_ACKNOWLEDGMENT_KEYS.uploadLicensePublishing,
    );

    if (!hasAcceptedUploadGuardrail) {
      return json(
        {
          success: false,
          intent,
          error:
            "Review and accept the license publishing acknowledgment before uploading beats.",
          requiresUploadGuardrail: true,
        } satisfies UploadActionData,
        { status: 403 },
      );
    }

    // Extract beat details
    const title = formData.get("title") as string;
    const bpm = parseInt(formData.get("bpm") as string, 10);
    const key = formData.get("key") as string;
    const genreGids = JSON.parse((formData.get("genreGids") as string) || "[]");
    const producerGids = JSON.parse(
      (formData.get("producerGids") as string) || "[]",
    );
    const producerAlias = (formData.get("producerAlias") as string) || "";
    const tags = normalizeProductTags(
      parseJsonField<string[]>((formData.get("tags") as string) || "[]", []),
    );
    const statusValue = (formData.get("status") as string) || "active";
    const productStatus = statusValue === "draft" ? "DRAFT" : "ACTIVE";
    const isDraft = productStatus === "DRAFT";
    const draftId = (formData.get("draftId") as string) || null;
    const coverArtFileId = (formData.get("coverArtFileId") as string) || null;

    // Extract license file assignments (maps tier -> array of temp file IDs)
    const licenseFilesData = JSON.parse(
      (formData.get("licenseFiles") as string) || "{}",
    );
    const licensePricesData = JSON.parse(
      (formData.get("licensePrices") as string) || "{}",
    );
    const stemsAddonSelectionsData = parseJsonField<StemsAddonSelections>(
      (formData.get("stemsAddonSelections") as string) || "{}",
      {},
    );
    const uploadedFilesStateRaw = formData.get("uploadedFilesState") as
      | string
      | null;
    const uploadedFilesState = parseJsonField<UploadedFile[]>(
      uploadedFilesStateRaw || "[]",
      [],
    );
    const effectiveSelectedLicenseIds = dedupeIds(
      parseJsonField<string[]>(
        (formData.get("selectedLicenseIds") as string) || "[]",
        [],
      ),
    );
    const selectionState = parseJsonField<LicenseSelectionState>(
      (formData.get("licenseSelectionState") as string) || "",
      {
        selectedBundleIds: [STARTER_BUNDLE_ID],
        selectedLicenseIds: effectiveSelectedLicenseIds,
      },
    );

    // Extract preview file ID
    const previewFileId = formData.get("previewFileId") as string | null;

    // Extract file metadata (maps temp file ID -> metadata including purpose)
    const fileMetadataJson = (formData.get("fileMetadata") as string) || "{}";
    const fileMetadata = JSON.parse(fileMetadataJson);

    const existingDraft = draftId
      ? await findBeatDraftByIdCompat(draftId, session.shop)
      : null;

    const savedDraftUploadedFiles = existingDraft
      ? parseJsonField<UploadedFile[]>(existingDraft.uploadedFilesJson, [])
      : [];
    const existingUploadedFiles =
      uploadedFilesStateRaw !== null
        ? uploadedFilesState
            .map(
              (file) =>
                savedDraftUploadedFiles.find(
                  (savedFile) => savedFile.id === file.id,
                ) || file,
            )
            .filter(isLicenseDeliveryFile)
        : savedDraftUploadedFiles;
    const existingPreviewFile = existingDraft
      ? parseJsonField<UploadedFile | null>(existingDraft.previewFileJson, null)
      : null;
    const existingCoverArtFile = existingDraft
      ? parseJsonField<UploadedFile | null>(
          existingDraft.coverArtFileJson,
          null,
        )
      : null;
    const existingFilesById = new Map(
      dedupeFilesById([
        ...existingUploadedFiles,
        existingPreviewFile,
        existingCoverArtFile,
      ]).map((file) => [file.id, file]),
    );

    // === SERVER-SIDE VALIDATION ===

    const titleError = getTitleValidationError(title);

    if (isDraft && titleError) {
      return json(
        {
          success: false,
          error: titleError,
        },
        { status: 400 },
      );
    }

    // Validate preview file exists for active beats
    if (!isDraft && !previewFileId) {
      return json(
        { success: false, error: "Upload a preview MP3 before saving active." },
        { status: 400 },
      );
    }

    // Get actual license GIDs from the database
    const dbLicenses = await productService.getLicenseMetaobjects();
    const selectedLicenses = orderLicensesByIds(
      dbLicenses,
      effectiveSelectedLicenseIds.filter((id) =>
        dbLicenses.some((license) => license.id === id),
      ),
    );
    const templateIds = selectedLicenses.map((license) => license.id);

    const submittedDeliveryFiles = uploadedFilesState.filter(isLicenseDeliveryFile);
    const validationUploadedFiles = dedupeFilesById([
      ...submittedDeliveryFiles,
      ...existingUploadedFiles,
    ]);
    const validationPreviewFile =
      (previewFileId
        ? uploadedFilesState.find((file) => file.id === previewFileId) ||
          existingPreviewFile
        : null) || null;

    if (!isDraft) {
      const validationErrors = getUploadValidationErrors({
        title,
        bpm,
        key,
        genreGids,
        producerGids,
        previewFile: validationPreviewFile,
        selectedLicenses,
        uploadedFiles: validationUploadedFiles,
        licenseFiles: licenseFilesData,
        licensePrices: licensePricesData,
        stemsAddonSelections: stemsAddonSelectionsData,
      });

      if (hasUploadValidationErrors(validationErrors)) {
        return json(
          {
            success: false,
            error: validationErrors.bannerMessages[0] || "Complete the required fields before saving active.",
          },
          { status: 400 },
        );
      }
    }

    if (!isDraft && selectedLicenses.length === 0) {
      return json(
        {
          success: false,
          error:
            "Choose at least one license offer before saving this beat as active.",
        },
        { status: 400 },
      );
    }

    // Validate each license tier has the full package its template promises
    const missingAssignments: string[] = [];

    if (!isDraft) {
      for (const license of selectedLicenses) {
        const filesForTier = licenseFilesData[license.id];
        const requiredFormats = getRequiredDeliveryFormats(license);

        if (
          !filesForTier ||
          !Array.isArray(filesForTier) ||
          filesForTier.length === 0
        ) {
          missingAssignments.push(
            `${license.licenseName}: ${requiredFormats.map(formatDeliveryFormatLabel).join(", ") || "package files"}`,
          );
          continue;
        }

        const assignedFormats = new Set(
          filesForTier
            .map(
              (fileId: string) =>
                fileMetadata[fileId]?.purpose ||
                fileMetadata[fileId]?.type ||
                existingFilesById.get(fileId)?.purpose ||
                existingFilesById.get(fileId)?.type ||
                "",
            )
            .map((format: string) => normalizeDeliveryFormat(format))
            .filter((format: DeliveryFormat | null): format is DeliveryFormat =>
              Boolean(format),
            ),
        );

        const missingFormats = requiredFormats.filter(
          (format) => !assignedFormats.has(format),
        );
        if (missingFormats.length > 0) {
          missingAssignments.push(
            `${license.licenseName}: ${missingFormats.map(formatDeliveryFormatLabel).join(", ")}`,
          );
        }
      }
    }

    const stemsSourceRequired = selectedLicenses.some((license) =>
      licenseOffersStems(
        resolveOfferStemsPolicy(
          license.stemsPolicy,
          stemsAddonSelectionsData[license.id],
          license.offerArchetype,
        ),
      ),
    );
    const sharedStemsFilePresent = hasSharedStemsSourceFile(
      existingUploadedFiles,
    );

    if (!isDraft && stemsSourceRequired && !sharedStemsFilePresent) {
      const affectedLicenses = selectedLicenses
        .filter((license) =>
          licenseOffersStems(
            resolveOfferStemsPolicy(
              license.stemsPolicy,
              stemsAddonSelectionsData[license.id],
              license.offerArchetype,
            ),
          ),
        )
        .map((license) => license.licenseName);

      return json(
        {
          success: false,
          error: `Upload one stems ZIP before publishing this beat. Required because these offers include stems or sell stems as an add-on: ${affectedLicenses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (missingAssignments.length > 0) {
      return json(
        {
          success: false,
          error: `Some license packages are missing required files. ${missingAssignments.join(" | ")}`,
        },
        { status: 400 },
      );
    }

    if (!isDraft) {
      const missingPrices = selectedLicenses
        .filter((license) => {
          const rawPrice = licensePricesData[license.id];
          if (rawPrice == null || String(rawPrice).trim() === "") return true;
          const parsed = Number.parseFloat(String(rawPrice));
          return !Number.isFinite(parsed) || parsed <= 0;
        })
        .map((license) => license.licenseName);

      if (missingPrices.length > 0) {
        return json(
          {
            success: false,
            error: `Add a price for each license offer before saving active. Missing: ${missingPrices.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    // Collect all file entries from formData
    const fileEntries: Array<{ tempId: string; file: File; purpose: string }> =
      [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const tempId = key.replace("file_", "");
        const metadata = fileMetadata[tempId] || {};
        fileEntries.push({
          tempId,
          file: value,
          purpose: metadata.purpose || "other",
        });
      }
    }

    if (!isDraft && fileEntries.length === 0 && existingFilesById.size === 0) {
      return json(
        { success: false, error: "No files were uploaded" },
        { status: 400 },
      );
    }

    // Validate that any assigned files actually exist in the current upload payload
    const allAssignedFileIds = new Set<string>();
    if (previewFileId) {
      allAssignedFileIds.add(previewFileId);
    }
    for (const templateId of templateIds) {
      const filesForTier = licenseFilesData[templateId] || [];
      for (const fileId of filesForTier) {
        allAssignedFileIds.add(fileId);
      }
    }

    const uploadedTempIds = new Set(fileEntries.map((e) => e.tempId));
    const knownFileIds = new Set([
      ...uploadedTempIds,
      ...existingFilesById.keys(),
    ]);
    const missingFiles = Array.from(allAssignedFileIds).filter(
      (id) => !knownFileIds.has(id),
    );

    if (!isDraft && missingFiles.length > 0) {
      return json(
        {
          success: false,
          error: `Some assigned files were not found in the upload. Please re-upload the files.`,
        },
        { status: 400 },
      );
    }

    const producers = await productService.getProducerMetaobjects();
    const selectedProducers = producers.filter((p) =>
      producerGids.includes(p.id),
    );
    const producerNames = selectedProducers.map((p) => p.name);

    // Generate beat slug for storage path
    const beatSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // === UPLOAD FILES TO STORAGE ===
    console.info("[upload] uploading files to configured storage");

    // Prepare files for upload with their purpose
    const filesToUpload: DynamicFileUpload[] = fileEntries.map((entry) => {
      const metadata = fileMetadata[entry.tempId] || {};
      return {
        file: entry.file,
        fileType: metadata.type || "other",
        originalName: metadata.name || entry.file.name,
        purpose: entry.purpose, // Pass purpose for tracking
      };
    });

    // Upload all files
    const uploadResults =
      filesToUpload.length > 0
        ? await uploadDynamicFilesForShop(session.shop, filesToUpload, beatSlug)
        : [];

    // Create a map from tempId to upload result
    const tempIdToResult = new Map<string, UploadedFileResult>();
    for (let i = 0; i < fileEntries.length; i++) {
      tempIdToResult.set(fileEntries[i].tempId, uploadResults[i]);
    }

    const uploadedFilesWithStorage = new Map<string, UploadedFile>();
    for (const entry of fileEntries) {
      const result = tempIdToResult.get(entry.tempId);
      const metadata = fileMetadata[entry.tempId] || {};
      if (!result) continue;

      uploadedFilesWithStorage.set(entry.tempId, {
        id: entry.tempId,
        name: metadata.name || entry.file.name,
        type: metadata.type || entry.purpose || "other",
        purpose: metadata.purpose || entry.purpose || "other",
        size: metadata.size || `${result.size}`,
        storageUrl: result.storageUrl,
        storageKey: result.storageKey,
      });
    }

    // Track cover art resource by purpose
    let coverArtUrl: string | undefined;

    // Upload cover art to Shopify's CDN directly to prevent "Media processing failed" timeouts
    const coverEntry = fileEntries.find(
      (e) => e.purpose === "cover" || e.file.type.startsWith("image/"),
    );
    let shopifyCoverResourceUrl: string | undefined;

    if (coverEntry) {
      console.info(
        "[upload] uploading cover art directly to Shopify CDN via stagedUploadsCreate",
      );
      try {
        shopifyCoverResourceUrl = await productService.uploadImageToShopify(
          coverEntry.file,
        );
      } catch (err) {
        console.error("Failed to upload cover art to Shopify:", err);
      }
    }

    const mergedPreviewFile: UploadedFile | null = previewFileId
      ? uploadedFilesWithStorage.get(previewFileId) ||
        existingFilesById.get(previewFileId) ||
        null
      : null;
    const mergedCoverArtFileBase: UploadedFile | null = coverArtFileId
      ? uploadedFilesWithStorage.get(coverArtFileId) ||
        existingFilesById.get(coverArtFileId) ||
        null
      : null;
    const mergedCoverArtFile: UploadedFile | null = mergedCoverArtFileBase
      ? {
          ...mergedCoverArtFileBase,
          shopifyResourceUrl:
            shopifyCoverResourceUrl ||
            mergedCoverArtFileBase.shopifyResourceUrl ||
            undefined,
        }
      : null;

    const mergedLicenseFilePoolByPurpose = new Map<string, UploadedFile>();
    [
      ...existingUploadedFiles,
      ...Array.from(uploadedFilesWithStorage.values()).filter(
        isLicenseDeliveryFile,
      ),
    ].forEach((file) => {
      const purposeKey = isLicenseDeliveryFile(file) ? file.purpose : file.id;
      mergedLicenseFilePoolByPurpose.set(purposeKey, file);
    });
    const mergedUploadedFiles = Array.from(
      mergedLicenseFilePoolByPurpose.values(),
    );

    coverArtUrl =
      mergedCoverArtFile?.shopifyResourceUrl || mergedCoverArtFile?.storageUrl;

    if (isDraft) {
      const draftData = {
        shop: session.shop,
        title,
        bpm: bpm || null,
        key: key || null,
        producerAlias: producerAlias || null,
        tagsJson: JSON.stringify(tags),
        genreGidsJson: JSON.stringify(genreGids),
        producerGidsJson: JSON.stringify(producerGids),
        licenseFilesJson: JSON.stringify(licenseFilesData),
        licensePricesJson: JSON.stringify(licensePricesData),
        stemsAddonSelectionsJson: JSON.stringify(stemsAddonSelectionsData),
        selectionStateJson: JSON.stringify({
          selectedBundleIds: dedupeIds(selectionState.selectedBundleIds || []),
          selectedLicenseIds: dedupeIds(selectionState.selectedLicenseIds || []),
        } satisfies LicenseSelectionState),
        uploadedFilesJson: JSON.stringify(mergedUploadedFiles),
        previewFileJson: mergedPreviewFile
          ? JSON.stringify(mergedPreviewFile)
          : null,
        coverArtFileJson: mergedCoverArtFile
          ? JSON.stringify(mergedCoverArtFile)
          : null,
      };

      const savedDraft = await saveBeatDraftCompat({
        existingDraftId: existingDraft?.id,
        data: draftData,
      });

      if (selectedLicenses.length > 0) {
        await persistLastUsedOfferSelection(session.shop, selectionState);
      }

      console.info("[upload] draft saved successfully", {
        draftId: savedDraft.id,
      });
      return json({
        success: true,
        redirectTo: "/app/beats?success=true&status=draft",
      } satisfies UploadActionData);
    }

    // Get actual license GIDs from the database
    const licenses = selectedLicenses;

    // === CREATE SHOPIFY PRODUCT ===
    console.info("[upload] creating Shopify product");

    // Prepare license prices
    const licensePrices = licenses.map((lp) => {
      const customPriceStr = licensePricesData[lp.id];
      const customPrice = customPriceStr ? parseFloat(customPriceStr) : 0;
      return {
        templateId: lp.id,
        licenseGid: lp.id,
        licenseName: lp.licenseName,
        price: isNaN(customPrice) ? 0 : customPrice,
        compareAtPrice: undefined,
        stemsAddonEnabled:
          resolveOfferStemsPolicy(
            lp.stemsPolicy,
            stemsAddonSelectionsData[lp.id],
            lp.offerArchetype,
          ) === "available_as_addon",
      };
    });

    const result = await productService.createBeatProduct({
      title,
      bpm,
      key,
      status: productStatus,
      genreGids,
      producerGids,
      producerNames,
      producerAlias: producerAlias || undefined,
      tags,
      licenses: licensePrices,
      coverArtUrl:
        shopifyCoverResourceUrl ||
        mergedCoverArtFile?.shopifyResourceUrl ||
        coverArtUrl,
    });

    // === SAVE FILE MAPPINGS TO DATABASE ===
    console.info("[upload] saving file mappings to database", {
      productId: result.productId,
    });

    const productId = result.productId;

    // Create BeatFile records for each uploaded file
    const beatFileRecords: Array<{ id: string; tempId: string }> = [];

    const allPersistedFiles = dedupeFilesById([
      ...mergedUploadedFiles,
      mergedPreviewFile,
      mergedCoverArtFile,
    ]).filter((file): file is UploadedFile & { storageUrl: string } =>
      Boolean(file.storageUrl),
    );

    for (const file of allPersistedFiles) {
      const sizeInBytes =
        typeof file.size === "number"
          ? file.size
          : Math.round(
              parseFloat(String(file.size).replace(/[^\d.]/g, "")) *
                (String(file.size).includes("MB")
                  ? 1024 * 1024
                  : String(file.size).includes("KB")
                    ? 1024
                    : 1),
            );

      const beatFile = await prisma.beatFile.create({
        data: {
          shop: session.shop,
          beatId: productId,
          filename: file.name,
          storageUrl: file.storageUrl!,
          storageKey: file.storageKey || null,
          fileType: file.type,
          filePurpose: file.purpose,
          size: sizeInBytes,
        },
      });

      beatFileRecords.push({ id: beatFile.id, tempId: file.id });
    }

    // Create a map from tempId to database BeatFile id
    const tempIdToDbId = new Map(beatFileRecords.map((r) => [r.tempId, r.id]));

    if (mergedPreviewFile?.id && tempIdToDbId.get(mergedPreviewFile.id)) {
      await productService.setProductPreviewPlaybackUrl(productId);
    }

    const templateIdToVariantId = new Map(
      result.variants
        .filter((variant) => variant.id && variant.templateId)
        .map((variant) => [variant.templateId, variant.id]),
    );

    // Create LicenseFileMapping records for each created Shopify variant
    for (const templateId of templateIds) {
      const variantId = templateIdToVariantId.get(templateId);
      if (!variantId) {
        throw new Error(
          `Missing Shopify variant mapping for template "${templateId}"`,
        );
      }
      const normalizedVariantId = normalizeShopifyResourceId(variantId);

      const tempFileIdsForTier = licenseFilesData[templateId] || [];

      for (
        let sortOrder = 0;
        sortOrder < tempFileIdsForTier.length;
        sortOrder++
      ) {
        const tempId = tempFileIdsForTier[sortOrder];
        const dbFileId = tempIdToDbId.get(tempId);

        if (dbFileId) {
          await prisma.licenseFileMapping.create({
            data: {
              variantId: normalizedVariantId,
              fileId: dbFileId,
              sortOrder,
            },
          });
        }
      }
    }

    if (existingDraft) {
      await prisma.beatDraft.delete({
        where: { id: existingDraft.id },
      });
    }

    if (selectedLicenses.length > 0) {
      await persistLastUsedOfferSelection(session.shop, selectionState);
    }

    console.info("[upload] completed successfully", {
      productId: result.productId,
    });
    return json({
      success: true,
      redirectTo: `/app/beats?success=true&status=${statusValue}`,
    } satisfies UploadActionData);
  } catch (error) {
    console.error("Upload error:", error);
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
};

export default function NewBeatPage() {
  const loaderData = useLoaderData<typeof loader>();
  const licenses = loaderData.licenses as UploadLicense[];
  const bundles = (loaderData.bundles || []) as UploadLicenseBundle[];
  const lastUsedSelectionState = sanitizeLicenseSelectionState(
    (loaderData.lastUsedSelectionState as LicenseSelectionState | undefined) ||
      buildDefaultSelectionState(),
    bundles,
    licenses,
  );
  const genres = loaderData.genres;
  const producers = loaderData.producers;
  const draft = loaderData.draft;
  const storageWarning = loaderData.storageWarning;
  const requiresUploadGuardrail = loaderData.requiresUploadGuardrail;
  const loaderError = loaderData.error;
  const fetcher = useFetcher<UploadActionData>();
  const acknowledgmentFetcher = useFetcher<UploadActionData>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const initialSelectionState = useMemo(
    () =>
      sanitizeLicenseSelectionState(
        draft?.selectionState,
        bundles,
        licenses as UploadLicense[],
      ),
    [bundles, draft?.selectionState, licenses],
  );
  const lastUsedLicenses = useMemo(
    () => resolveSelectedLicenses(lastUsedSelectionState, bundles, licenses),
    [bundles, lastUsedSelectionState, licenses],
  );
  const hasLastUsedOfferSelection = lastUsedLicenses.length > 0;

  const initialTitle = draft?.title || "";
  const initialBpm = draft?.bpm || "";
  const initialKey = draft?.key || "C minor";
  const initialGenreGids = useMemo(
    () =>
      draft?.genreGids?.length
        ? draft.genreGids
        : genres[0]?.id
          ? [genres[0].id]
          : [],
    [draft?.genreGids, genres],
  );
  const initialProducerGids = useMemo(
    () =>
      draft?.producerGids?.length
        ? draft.producerGids
        : producers[0]?.id
          ? [producers[0].id]
          : [],
    [draft?.producerGids, producers],
  );
  const initialProducerAlias = draft?.producerAlias || "";
  const initialTags = useMemo(
    () => normalizeProductTags((draft?.tags || []) as string[]),
    [draft?.tags],
  );
  const initialStatus = draft ? "draft" : "active";
  const initialSelectedBundleIds = initialSelectionState.selectedBundleIds;
  const initialSelectedLicenseIds = initialSelectionState.selectedLicenseIds;
  const initialBundleLicenseOverrides =
    initialSelectionState.bundleLicenseOverrides || {};
  const initialUploadedFiles = useMemo(
    () => (draft?.uploadedFiles || []) as UploadedFile[],
    [draft?.uploadedFiles],
  );
  const initialLicenseFiles = useMemo(() => {
    const draftLicenseFiles = draft?.licenseFiles || {};
    const obj: LicenseFiles = {};
    if (licenses) {
      licenses.filter(Boolean).forEach((license) => {
        obj[license!.id] =
          readTemplateScopedValue(draftLicenseFiles, license!) || [];
      });
    }
    return obj;
  }, [draft?.licenseFiles, licenses]);
  const initialLicensePrices = useMemo(() => {
    const draftLicensePrices = draft?.licensePrices || {};
    const obj: Record<string, string> = {};
    if (licenses) {
      licenses.filter(Boolean).forEach((license) => {
        obj[license!.id] =
          readTemplateScopedValue(draftLicensePrices, license!) || "";
      });
    }
    return obj;
  }, [draft?.licensePrices, licenses]);
  const initialStemsAddonSelections = useMemo(() => {
    const draftStemsSelections = draft?.stemsAddonSelections || {};
    const obj: StemsAddonSelections = {};
    if (licenses) {
      licenses.filter(Boolean).forEach((license) => {
        obj[license!.id] = Boolean(
          readTemplateScopedValue(draftStemsSelections, license!),
        );
      });
    }
    return obj;
  }, [draft?.stemsAddonSelections, licenses]);
  const initialPreviewFile = (draft?.previewFile ||
    null) as UploadedFile | null;
  const initialCoverArtFile = (draft?.coverArtFile ||
    null) as UploadedFile | null;

  // Form state
  const [title, setTitle] = useState(initialTitle);
  const [bpm, setBpm] = useState(initialBpm);
  const [key, setKey] = useState(initialKey);
  const [genreGids, setGenreGids] = useState<string[]>(initialGenreGids);
  const [producerGids, setProducerGids] =
    useState<string[]>(initialProducerGids);
  const [producerAlias, setProducerAlias] = useState(initialProducerAlias);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [status, setStatus] = useState(initialStatus);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>(
    initialSelectedBundleIds,
  );
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<string[]>(
    initialSelectedLicenseIds,
  );
  const [bundleLicenseOverrides, setBundleLicenseOverrides] = useState<
    Record<string, string[]>
  >(initialBundleLicenseOverrides);

  // License file assignment state
  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>(initialUploadedFiles);
  const [licenseFiles, setLicenseFiles] =
    useState<LicenseFiles>(initialLicenseFiles);
  const [licensePrices, setLicensePrices] =
    useState<Record<string, string>>(initialLicensePrices);
  const [stemsAddonSelections, setStemsAddonSelections] =
    useState<StemsAddonSelections>(initialStemsAddonSelections);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(
    initialPreviewFile,
  );
  const [coverArtFile, setCoverArtFile] = useState<UploadedFile | null>(
    initialCoverArtFile,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaveSubmitting, setIsSaveSubmitting] = useState(false);
  const [suppressSaveBar, setSuppressSaveBar] = useState(false);
  const [hasAcceptedUploadGuardrail, setHasAcceptedUploadGuardrail] = useState(
    !requiresUploadGuardrail,
  );
  const [uploadGuardrailChecked, setUploadGuardrailChecked] = useState(false);
  const [offerPickerOpen, setOfferPickerOpen] = useState(false);
  const [offerPickerSearchValue, setOfferPickerSearchValue] = useState("");
  const [offerPickerLicenseDraftIds, setOfferPickerLicenseDraftIds] = useState<
    string[]
  >([]);
  const [initialOfferPickerLicenseDraftIds, setInitialOfferPickerLicenseDraftIds] =
    useState<string[]>([]);
  const [editingOfferGroupId, setEditingOfferGroupId] = useState<string | null>(
    null,
  );
  const [validationTouched, setValidationTouched] = useState<{
    title: boolean;
    bpm: boolean;
    key: boolean;
    genreGids: boolean;
    producerGids: boolean;
    previewFile: boolean;
    selectedOffers: boolean;
    deliveryFiles: boolean;
    priceByLicenseId: Record<string, boolean>;
  }>({
    title: false,
    bpm: false,
    key: false,
    genreGids: false,
    producerGids: false,
    previewFile: false,
    selectedOffers: false,
    deliveryFiles: false,
    priceByLicenseId: {},
  });
  const [saveAttemptMode, setSaveAttemptMode] = useState<
    "draft" | "active" | null
  >(null);
  const offerPickerContentRef = useRef<HTMLDivElement | null>(null);
  const offerPickerLastPointerDownLocationRef = useRef<
    "inside" | "outside" | null
  >(null);
  const [offerPickerBlockedCloseAttemptCount, setOfferPickerBlockedCloseAttemptCount] =
    useState(0);

  // Handle file upload with purpose
  const handleFileUpload = useCallback(
    async (
      files: File[],
      purpose: "preview" | "license",
    ): Promise<UploadedFile[]> => {
      setIsUploading(true);
      setUploadError(null);

      try {
        // Create local file entries with temporary IDs and purpose
        const newFiles: UploadedFile[] = files.map((file) => {
          const fileType = detectFileType(file.name);
          return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: purpose === "preview" ? "preview" : fileType,
            purpose:
              purpose === "preview"
                ? "preview"
                : fileType === "mp3" ||
                    fileType === "wav" ||
                    fileType === "stems"
                  ? fileType
                  : "other",
            size: formatFileSize(file.size),
            file: file,
          };
        });

        return newFiles;
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : "Upload failed",
        );
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  // Detect file type
  const detectFileType = (filename: string): UploadedFile["type"] => {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "mp3") return "mp3";
    if (ext === "wav") return "wav";
    if (ext === "zip") return "stems";
    if (["jpg", "jpeg", "png"].includes(ext || "")) return "cover";
    return "other";
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasRequiredBeatFields = () =>
    Boolean(
      title && bpm && key && genreGids.length > 0 && producerGids.length > 0,
    );
  const selectionState = useMemo<LicenseSelectionState>(
    () => ({
      selectedBundleIds,
      selectedLicenseIds:
        (licenses as UploadLicense[])
          .filter((license) => selectedLicenseIds.includes(license.id))
          .map((license) => license.id),
      bundleLicenseOverrides: Object.fromEntries(
        Object.entries(bundleLicenseOverrides).filter(([bundleId]) =>
          selectedBundleIds.includes(bundleId),
        ),
      ),
    }),
    [bundleLicenseOverrides, licenses, selectedBundleIds, selectedLicenseIds],
  );
  const selectedLicenses = useMemo(
    () =>
      resolveSelectedLicenses(
        selectionState,
        bundles as UploadLicenseBundle[],
        licenses as UploadLicense[],
      ),
    [bundles, licenses, selectionState],
  );
  const selectedIndividualLicenseSummary = useMemo(() => {
    const bundledLicenseIds = new Set(
      bundles
        .filter((bundle) => selectedBundleIds.includes(bundle.id))
        .flatMap(
          (bundle) =>
            selectionState.bundleLicenseOverrides?.[bundle.id] ||
            getBundleActiveLicenseIds(bundle, licenses as UploadLicense[]),
        ),
    );

    return (licenses as UploadLicense[])
      .filter(
        (license) =>
          selectedLicenseIds.includes(license.id) &&
          !bundledLicenseIds.has(license.id),
      )
      .map((license) => license.licenseName);
  }, [bundles, licenses, selectedBundleIds, selectedLicenseIds, selectionState.bundleLicenseOverrides]);
  const selectedOfferGroups = useMemo<LicenseOfferGroup[]>(() => {
    const bundlesById = new Map(
      (bundles as UploadLicenseBundle[]).map((bundle) => [bundle.id, bundle]),
    );
    const licensesById = new Map(
      (licenses as UploadLicense[]).map((license) => [license.id, license]),
    );
    const groups: LicenseOfferGroup[] = selectedBundleIds
      .map((bundleId) => bundlesById.get(bundleId))
      .filter((bundle): bundle is UploadLicenseBundle => Boolean(bundle))
      .map((bundle) => ({
        id: `bundle:${bundle.id}`,
        title: bundle.name,
        kind: "bundle" as const,
        licenseNames: (
          selectionState.bundleLicenseOverrides?.[bundle.id] ||
          getBundleActiveLicenseIds(bundle, licenses as UploadLicense[])
        )
          .map((licenseId) => licensesById.get(licenseId)?.licenseName || null)
          .filter((licenseName): licenseName is string => Boolean(licenseName)),
        warning:
          bundle.missingLicenseCount > 0
            ? `${bundle.missingLicenseCount} removed ${bundle.missingLicenseCount === 1 ? "license" : "licenses"}. Review this bundle on the Licenses page.`
            : undefined,
        isEditing: editingOfferGroupId === `bundle:${bundle.id}`,
        availableLicenses: getBundleActiveLicenseIds(
          bundle,
          licenses as UploadLicense[],
        ).map((licenseId) => ({
          id: licenseId,
          name: licensesById.get(licenseId)?.licenseName || "Unknown license",
          selected: (
            selectionState.bundleLicenseOverrides?.[bundle.id] ||
            getBundleActiveLicenseIds(bundle, licenses as UploadLicense[])
          ).includes(licenseId),
        })),
      }));

    if (selectedIndividualLicenseSummary.length > 0) {
      groups.push({
        id: "individual-licenses",
        title: "Individual licenses",
        kind: "individual",
        licenseNames: selectedIndividualLicenseSummary,
        isEditing: editingOfferGroupId === "individual-licenses",
      });
    }

    return groups;
  }, [
    bundles,
    editingOfferGroupId,
    licenses,
    selectedBundleIds,
    selectedIndividualLicenseSummary,
    selectionState.bundleLicenseOverrides,
  ]);
  const addableBundles = useMemo(
    () =>
      (bundles as UploadLicenseBundle[])
        .filter((bundle) => !selectedBundleIds.includes(bundle.id))
        .map((bundle) => ({
          id: bundle.id,
          title: bundle.name,
          subtitle:
            bundle.licenseNames.length > 0
              ? bundle.licenseNames.join(", ")
              : "No active licenses in this bundle.",
          warning:
            bundle.missingLicenseCount > 0
              ? bundle.missingLicenseCount === bundle.licenseMetaobjectIds.length
                ? "This bundle no longer contains active licenses."
                : `${bundle.missingLicenseCount} removed ${bundle.missingLicenseCount === 1 ? "license" : "licenses"}.`
              : undefined,
          disabled:
            bundle.missingLicenseCount > 0 &&
            bundle.resolvedLicenseMetaobjectIds.length === 0,
        })),
    [bundles, selectedBundleIds],
  );
  const offerPickerHasChanges = useMemo(
    () =>
      !arraysEqual(
        [...offerPickerLicenseDraftIds].sort(),
        [...initialOfferPickerLicenseDraftIds].sort(),
      ),
    [initialOfferPickerLicenseDraftIds, offerPickerLicenseDraftIds],
  );
  const filteredIndividualLicenses = useMemo(() => {
    const normalizedQuery = offerPickerSearchValue.trim().toLowerCase();
    if (!normalizedQuery) return licenses as UploadLicense[];

    return (licenses as UploadLicense[]).filter((license) => {
      const searchableText = [
        license.licenseName,
        license.storefrontSummary,
        getRequiredDeliveryFormats(license).map(formatDeliveryFormatLabel).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [licenses, offerPickerSearchValue]);
  const offerPickerPreviewSelectedLicenses = useMemo(
    () =>
      orderLicensesByIds(
        licenses as UploadLicense[],
        offerPickerLicenseDraftIds,
      ),
    [licenses, offerPickerLicenseDraftIds],
  );
  const titleValidationError = getTitleValidationError(title);
  const activeValidationErrors = useMemo(
    () =>
      getUploadValidationErrors({
        title,
        bpm,
        key,
        genreGids,
        producerGids,
        previewFile,
        selectedLicenses,
        uploadedFiles,
        licenseFiles,
        licensePrices,
        stemsAddonSelections,
      }),
    [
      bpm,
      genreGids,
      key,
      licenseFiles,
      licensePrices,
      previewFile,
      producerGids,
      selectedLicenses,
      stemsAddonSelections,
      title,
      uploadedFiles,
    ],
  );

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: initialTitle,
        bpm: initialBpm,
        key: initialKey,
        genreGids: initialGenreGids,
        producerGids: initialProducerGids,
        producerAlias: initialProducerAlias,
        tags: initialTags,
        status: initialStatus,
        selectionState: {
          selectedBundleIds: initialSelectedBundleIds,
          selectedLicenseIds: initialSelectedLicenseIds,
          bundleLicenseOverrides: initialBundleLicenseOverrides,
        },
        uploadedFiles: serializeUploadedFiles(initialUploadedFiles),
        licenseFiles: initialLicenseFiles,
        licensePrices: initialLicensePrices,
        stemsAddonSelections: initialStemsAddonSelections,
        previewFile: serializeUploadedFile(initialPreviewFile),
        coverArtFile: serializeUploadedFile(initialCoverArtFile),
      }),
    [
      initialBpm,
      initialCoverArtFile,
      initialGenreGids,
      initialKey,
      initialLicenseFiles,
      initialLicensePrices,
      initialBundleLicenseOverrides,
      initialSelectedBundleIds,
      initialSelectedLicenseIds,
      initialStemsAddonSelections,
      initialPreviewFile,
      initialProducerAlias,
      initialProducerGids,
      initialTags,
      initialStatus,
      initialTitle,
      initialUploadedFiles,
    ],
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        bpm,
        key,
        genreGids,
        producerGids,
        producerAlias,
        tags,
        status,
        selectionState,
        uploadedFiles: serializeUploadedFiles(uploadedFiles),
        licenseFiles,
        licensePrices,
        stemsAddonSelections,
        previewFile: serializeUploadedFile(previewFile),
        coverArtFile: serializeUploadedFile(coverArtFile),
      }),
    [
      bpm,
      bundleLicenseOverrides,
      coverArtFile,
      genreGids,
      key,
      licenseFiles,
      licensePrices,
      selectionState,
      stemsAddonSelections,
      previewFile,
      producerAlias,
      producerGids,
      tags,
      status,
      title,
      uploadedFiles,
    ],
  );

  const isDirty = initialSnapshot !== currentSnapshot;
  const isSubmittingForm = fetcher.state !== "idle";
  const isBusy = isSubmittingForm || isUploading || isSaveSubmitting;
  const isAcceptingUploadGuardrail = acknowledgmentFetcher.state !== "idle";
  const showUploadGuardrail = !hasAcceptedUploadGuardrail;

  const isReadyForActive = () => {
    if (selectedLicenses.length === 0) {
      return false;
    }

    const sharedStemsFilePresent = hasSharedStemsSourceFile(uploadedFiles);
    const sharedStemsRequired = selectedLicenses.some((license) =>
        licenseOffersStems(
          resolveOfferStemsPolicy(
            license.stemsPolicy,
            stemsAddonSelections[license.id],
            license.offerArchetype,
          ),
        ),
      );
    const hasAllLicenseFiles = selectedLicenses.every((license) => {
      const requiredFormats = getRequiredDeliveryFormats(license);
      const assignedFileIds = licenseFiles[license.id] || [];
      const assignedFormats = new Set(
        assignedFileIds
          .map(
            (fileId) =>
              uploadedFiles.find((file) => file.id === fileId)?.purpose || "",
          )
          .map((format) => normalizeDeliveryFormat(format))
          .filter((format): format is DeliveryFormat => Boolean(format)),
      );

      return requiredFormats.every((format) => assignedFormats.has(format));
    });

    const hasAllLicensePrices = hasCompleteLicensePrices(
      selectedLicenses.map((license) => ({ id: license.id })),
      licensePrices,
    );

    return Boolean(
      hasRequiredBeatFields() &&
      previewFile &&
      hasAllLicenseFiles &&
      hasAllLicensePrices &&
      (!sharedStemsRequired || sharedStemsFilePresent),
    );
  };
  const saveActionLabel =
    status === "active"
      ? isBusy
        ? "Saving beat..."
        : "Save beat"
      : isBusy
        ? "Saving draft..."
        : "Save draft";
  const visibleTitleError =
    validationTouched.title || saveAttemptMode !== null
      ? titleValidationError
      : undefined;
  const shouldShowActiveErrors =
    status === "active" && saveAttemptMode === "active";
  const visibleBpmError =
    status === "active" &&
    (validationTouched.bpm || shouldShowActiveErrors)
      ? activeValidationErrors.bpm
      : undefined;
  const visibleKeyError =
    status === "active" &&
    (validationTouched.key || shouldShowActiveErrors)
      ? activeValidationErrors.key
      : undefined;
  const visibleGenreError =
    status === "active" &&
    (validationTouched.genreGids || shouldShowActiveErrors)
      ? activeValidationErrors.genreGids
      : undefined;
  const visibleProducerError =
    status === "active" &&
    (validationTouched.producerGids || shouldShowActiveErrors)
      ? activeValidationErrors.producerGids
      : undefined;
  const visibleOfferError =
    status === "active" &&
    (validationTouched.selectedOffers || shouldShowActiveErrors)
      ? activeValidationErrors.selectedOffers
      : undefined;
  const visiblePreviewError =
    status === "active" &&
    (validationTouched.previewFile || shouldShowActiveErrors)
      ? activeValidationErrors.previewFile
      : undefined;
  const visiblePriceErrors = Object.fromEntries(
    Object.entries(activeValidationErrors.priceByLicenseId).filter(
      ([licenseId]) =>
        status === "active" &&
        (validationTouched.priceByLicenseId[licenseId] ||
          shouldShowActiveErrors),
    ),
  );
  const visibleDeliveryErrors =
    status === "active" &&
    (validationTouched.deliveryFiles || shouldShowActiveErrors)
      ? activeValidationErrors.deliveryByLicenseId
      : {};
  const validationBannerMessages =
    saveAttemptMode === "draft"
      ? titleValidationError
        ? [titleValidationError]
        : []
      : status === "active" && saveAttemptMode === "active"
        ? activeValidationErrors.bannerMessages
        : [];

  const handleOpenOfferPicker = useCallback(() => {
    setOfferPickerLicenseDraftIds(selectedLicenseIds);
    setInitialOfferPickerLicenseDraftIds(selectedLicenseIds);
    setOfferPickerSearchValue("");
    setOfferPickerOpen(true);
  }, [selectedLicenseIds]);

  const handleCloseOfferPicker = useCallback(() => {
    setOfferPickerOpen(false);
  }, []);

  const handleRequestCloseOfferPicker = useCallback(() => {
    const shouldBlockClose =
      offerPickerHasChanges &&
      offerPickerLastPointerDownLocationRef.current === "outside";

    offerPickerLastPointerDownLocationRef.current = null;

    if (shouldBlockClose) {
      setOfferPickerBlockedCloseAttemptCount((count) => count + 1);
      return;
    }

    handleCloseOfferPicker();
  }, [handleCloseOfferPicker, offerPickerHasChanges]);

  const handleToggleOfferPickerLicense = useCallback((licenseId: string) => {
    setOfferPickerLicenseDraftIds((current) =>
      current.includes(licenseId)
        ? current.filter((id) => id !== licenseId)
        : [...current, licenseId],
    );
  }, []);

  const handleApplyOfferPicker = useCallback(() => {
    setValidationTouched((current) => ({
      ...current,
      selectedOffers: true,
    }));
    setSelectedLicenseIds(
      (licenses as UploadLicense[])
        .filter((license) => offerPickerLicenseDraftIds.includes(license.id))
        .map((license) => license.id),
    );
    setOfferPickerOpen(false);
  }, [licenses, offerPickerLicenseDraftIds]);

  const handleAddBundle = useCallback(
    (bundleId: string) => {
      const bundle = (bundles as UploadLicenseBundle[]).find(
        (candidate) => candidate.id === bundleId,
      );
      if (!bundle) return;

      setSelectedBundleIds((current) =>
        current.includes(bundleId) ? current : [...current, bundleId],
      );
      setValidationTouched((current) => ({
        ...current,
        selectedOffers: true,
      }));
      setBundleLicenseOverrides((current) => ({
        ...current,
        [bundleId]: getBundleActiveLicenseIds(bundle, licenses as UploadLicense[]),
      }));
      setEditingOfferGroupId(`bundle:${bundleId}`);
    },
    [bundles, licenses],
  );

  const handleEditOfferGroup = useCallback(
    (groupId: string) => {
      if (groupId === "individual-licenses") {
        handleOpenOfferPicker();
        return;
      }

      setEditingOfferGroupId(groupId);
    },
    [handleOpenOfferPicker],
  );

  const handleDoneEditingOfferGroup = useCallback(() => {
    setEditingOfferGroupId(null);
  }, []);

  const handleDeleteOfferGroup = useCallback((groupId: string) => {
    setValidationTouched((current) => ({
      ...current,
      selectedOffers: true,
    }));
    if (groupId === "individual-licenses") {
      setSelectedLicenseIds([]);
      setEditingOfferGroupId(null);
      return;
    }

    const bundleId = groupId.replace(/^bundle:/, "");
    setSelectedBundleIds((current) => current.filter((id) => id !== bundleId));
    setBundleLicenseOverrides((current) => {
      const next = { ...current };
      delete next[bundleId];
      return next;
    });
    setEditingOfferGroupId(null);
  }, []);

  const handleToggleOfferGroupLicense = useCallback(
    (groupId: string, licenseId: string) => {
      setValidationTouched((current) => ({
        ...current,
        selectedOffers: true,
      }));
      const bundleId = groupId.replace(/^bundle:/, "");
      const bundle = (bundles as UploadLicenseBundle[]).find(
        (candidate) => candidate.id === bundleId,
      );
      if (!bundle) return;

      const availableLicenseIds = getBundleActiveLicenseIds(
        bundle,
        licenses as UploadLicense[],
      );

      setBundleLicenseOverrides((current) => {
        const selectedIds = current[bundleId] || availableLicenseIds;
        const nextSelectedIds = selectedIds.includes(licenseId)
          ? selectedIds.filter((id) => id !== licenseId)
          : [...selectedIds, licenseId];

        return {
          ...current,
          [bundleId]: availableLicenseIds.filter((id) =>
            nextSelectedIds.includes(id),
          ),
        };
      });
    },
    [bundles, licenses],
  );

  const handleUseLastUsedOffers = useCallback(() => {
    setValidationTouched((current) => ({
      ...current,
      selectedOffers: true,
    }));
    setSelectedBundleIds(lastUsedSelectionState.selectedBundleIds);
    setSelectedLicenseIds(lastUsedSelectionState.selectedLicenseIds);
    setBundleLicenseOverrides(lastUsedSelectionState.bundleLicenseOverrides || {});
  }, [lastUsedSelectionState]);

  useEffect(() => {
    if (!offerPickerOpen || !offerPickerHasChanges) {
      setOfferPickerBlockedCloseAttemptCount(0);
    }
  }, [offerPickerHasChanges, offerPickerOpen]);

  useEffect(() => {
    if (!offerPickerOpen) {
      offerPickerLastPointerDownLocationRef.current = null;
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const dialog = offerPickerContentRef.current?.closest('[role="dialog"]');
      if (!(dialog instanceof HTMLElement)) {
        offerPickerLastPointerDownLocationRef.current = null;
        return;
      }

      const target = event.target;
      offerPickerLastPointerDownLocationRef.current =
        target instanceof Node && dialog.contains(target) ? "inside" : "outside";
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      offerPickerLastPointerDownLocationRef.current = null;
    };
  }, [offerPickerOpen]);

  useEffect(() => {
    if (offerPickerBlockedCloseAttemptCount === 0) return;

    const dialog = offerPickerContentRef.current?.closest('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) return;

    const buttons = Array.from(dialog.querySelectorAll("button")).slice(-2);
    const footerButtons = buttons.filter(
      (button): button is HTMLButtonElement =>
        button instanceof HTMLButtonElement,
    );

    if (footerButtons.length === 0) return;

    footerButtons.forEach((button) => {
      button.style.animation = "none";
      button.getBoundingClientRect();
      button.style.animation = "OfferPickerModal-shake 220ms ease";
    });

    const timeoutId = window.setTimeout(() => {
      footerButtons.forEach((button) => {
        button.style.animation = "";
      });
    }, 240);

    return () => {
      window.clearTimeout(timeoutId);
      footerButtons.forEach((button) => {
        button.style.animation = "";
      });
    };
  }, [offerPickerBlockedCloseAttemptCount]);

  const showOfferPickerUnsavedChangesFeedback =
    offerPickerHasChanges && offerPickerBlockedCloseAttemptCount > 0;

  useEffect(() => {
    setLicenseFiles((current) => {
      const next = buildAutomaticLicenseAssignments(
        selectedLicenses,
        uploadedFiles,
        current,
      );
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [selectedLicenses, uploadedFiles]);

  const resetFormState = useCallback(() => {
    setTitle(initialTitle);
    setBpm(initialBpm);
    setKey(initialKey);
    setGenreGids(initialGenreGids);
    setProducerGids(initialProducerGids);
    setProducerAlias(initialProducerAlias);
    setTags(initialTags);
    setStatus(initialStatus);
    setSelectedBundleIds(initialSelectedBundleIds);
    setSelectedLicenseIds(initialSelectedLicenseIds);
    setUploadedFiles(initialUploadedFiles);
    setLicenseFiles(initialLicenseFiles);
    setLicensePrices(initialLicensePrices);
    setStemsAddonSelections(initialStemsAddonSelections);
    setPreviewFile(initialPreviewFile);
    setCoverArtFile(initialCoverArtFile);
    setValidationTouched({
      title: false,
      bpm: false,
      key: false,
      genreGids: false,
      producerGids: false,
      previewFile: false,
      selectedOffers: false,
      deliveryFiles: false,
      priceByLicenseId: {},
    });
    setSaveAttemptMode(null);
    setUploadError(null);
  }, [
    initialBpm,
    initialCoverArtFile,
    initialGenreGids,
    initialKey,
    initialLicenseFiles,
    initialLicensePrices,
    initialSelectedBundleIds,
    initialSelectedLicenseIds,
    initialStemsAddonSelections,
    initialPreviewFile,
    initialProducerAlias,
    initialProducerGids,
    initialTags,
    initialStatus,
    initialTitle,
    initialUploadedFiles,
  ]);

  // Handle form submission
  const handleSubmit = (saveMode?: "draft" | "active") => {
    const resolvedStatus = saveMode || status;
    setSuppressSaveBar(false);

    if (resolvedStatus === "draft") {
      setSaveAttemptMode("draft");
      setValidationTouched((current) => ({
        ...current,
        title: true,
      }));

      if (titleValidationError) {
        return;
      }
    } else {
      setSaveAttemptMode("active");
      setValidationTouched((current) => ({
        ...current,
        title: true,
        bpm: true,
        key: true,
        genreGids: true,
        producerGids: true,
        previewFile: true,
        selectedOffers: true,
        deliveryFiles: true,
        priceByLicenseId: {
          ...current.priceByLicenseId,
          ...Object.fromEntries(
            selectedLicenses.map((license) => [license.id, true]),
          ),
        },
      }));

      if (hasUploadValidationErrors(activeValidationErrors)) {
        return;
      }
    }

    setIsSaveSubmitting(true);
    const formData = new FormData();
    if (draft?.id) {
      formData.append("draftId", draft.id);
    }
    formData.append("title", title);
    formData.append("bpm", bpm);
    formData.append("key", key);
    formData.append("genreGids", JSON.stringify(genreGids));
    formData.append("producerGids", JSON.stringify(producerGids));
    formData.append("producerAlias", producerAlias);
    formData.append("tags", JSON.stringify(tags));
    formData.append("status", resolvedStatus);
    formData.append(
      "selectedLicenseIds",
      JSON.stringify(selectedLicenses.map((license) => license.id)),
    );
    formData.append("licenseSelectionState", JSON.stringify(selectionState));
    formData.append("licenseFiles", JSON.stringify(licenseFiles));
    formData.append("licensePrices", JSON.stringify(licensePrices));
    formData.append(
      "stemsAddonSelections",
      JSON.stringify(stemsAddonSelections),
    );
    formData.append(
      "uploadedFilesState",
      JSON.stringify(
        uploadedFiles.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          purpose: file.purpose,
          size: file.size,
          storageUrl: file.storageUrl,
        })),
      ),
    );

    // Add preview file ID
    if (previewFile) {
      formData.append("previewFileId", previewFile.id);
    }
    formData.append("coverArtFileId", coverArtFile?.id || "");

    // Build file metadata map with purpose
    const fileMetadata: Record<
      string,
      { name: string; type: string; size: string; purpose: string }
    > = {};

    // Append cover art file
    if (coverArtFile?.file) {
      const fieldName = `file_${coverArtFile.id}`;
      formData.append(fieldName, coverArtFile.file);
      fileMetadata[coverArtFile.id] = {
        name: coverArtFile.name,
        type: coverArtFile.type,
        size: coverArtFile.size,
        purpose: "cover",
      };
    }

    // Append preview file
    if (previewFile?.file) {
      const fieldName = `file_${previewFile.id}`;
      formData.append(fieldName, previewFile.file);
      fileMetadata[previewFile.id] = {
        name: previewFile.name,
        type: previewFile.type,
        size: previewFile.size,
        purpose: previewFile.purpose,
      };
    }

    // Append license files
    uploadedFiles.forEach((uploadedFile) => {
      if (uploadedFile.file) {
        const fieldName = `file_${uploadedFile.id}`;
        formData.append(fieldName, uploadedFile.file);
        fileMetadata[uploadedFile.id] = {
          name: uploadedFile.name,
          type: uploadedFile.type,
          size: uploadedFile.size,
          purpose: uploadedFile.purpose,
        };
      }
    });

    formData.append("fileMetadata", JSON.stringify(fileMetadata));

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  };

  useEffect(() => {
    setHasAcceptedUploadGuardrail(!requiresUploadGuardrail);
    setUploadGuardrailChecked(false);
  }, [requiresUploadGuardrail]);

  useEffect(() => {
    if (
      fetcher.data &&
      "success" in fetcher.data &&
      fetcher.data.success === false
    ) {
      setIsSaveSubmitting(false);
      setSuppressSaveBar(false);
      if (fetcher.data.requiresUploadGuardrail) {
        setHasAcceptedUploadGuardrail(false);
      }
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      (!fetcher.data ||
        ("success" in fetcher.data && fetcher.data.success === false))
    ) {
      setIsSaveSubmitting(false);
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (
      acknowledgmentFetcher.data?.success &&
      acknowledgmentFetcher.data.intent === "accept_upload_guardrail"
    ) {
      setHasAcceptedUploadGuardrail(true);
      setUploadGuardrailChecked(false);
    }
  }, [acknowledgmentFetcher.data]);

  useEffect(() => {
    if (
      !fetcher.data ||
      !("success" in fetcher.data) ||
      fetcher.data.success !== true ||
      !("redirectTo" in fetcher.data) ||
      !fetcher.data.redirectTo ||
      suppressSaveBar
    ) {
      return;
    }

    setSuppressSaveBar(true);
    setIsSaveSubmitting(false);

    const redirectTo = fetcher.data.redirectTo;

    void shopify.saveBar
      .hide("beat-upload-save-bar")
      .catch(() => {})
      .finally(() => {
        navigate(redirectTo);
      });
  }, [fetcher.data, navigate, shopify, suppressSaveBar]);

  // Map the active license selection into the existing variant/file assignment UI.
  const dynamicLicenseTiers = selectedLicenses.map((license) => ({
    id: license.id,
    name: license.licenseName,
    price: licensePrices[license.id] ? `$${licensePrices[license.id]}` : "Not set",
    description: license.displayName,
    packageFormats: getRequiredDeliveryFormats(license),
    stemsPolicy: resolveOfferStemsPolicy(
      license.stemsPolicy,
      stemsAddonSelections[license.id],
      license.offerArchetype,
    ),
    templateStemsPolicy: license.stemsPolicy,
    stemsAddonEnabled: Boolean(stemsAddonSelections[license.id]),
  }));

  const genreOptions = genres.filter(Boolean).map((g) => ({
    label: g!.title,
    value: g!.id,
  }));

  const producerOptions = producers.filter(Boolean).map((p) => ({
    label: p!.name,
    value: p!.id,
  }));

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    handleSubmit(status === "draft" ? "draft" : "active");
  };

  const handleFormReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    resetFormState();
  };

  const handleBackAction = async () => {
    if (isDirty) {
      try {
        await shopify.saveBar.leaveConfirmation();
      } catch {
        return;
      }
    }

    navigate("/app/beats");
  };

  const handleAcceptUploadGuardrail = () => {
    const formData = new FormData();
    formData.append("intent", "accept_upload_guardrail");
    acknowledgmentFetcher.submit(formData, { method: "post" });
  };

  const handleCloseUploadGuardrail = () => {
    setUploadGuardrailChecked(false);
    navigate("/app");
  };

  if (loaderError) {
    return (
      <Page title="Upload New Beat">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load upload page" tone="critical">
              <p>{loaderError}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <>
      <Page
        title={draft?.id ? title || "Continue draft" : "Upload beat"}
        backAction={{ content: "Beats", onAction: handleBackAction }}
      >
        <SaveBar
          id="beat-upload-save-bar"
          open={
            !suppressSaveBar &&
            (isDirty || isSubmittingForm || isSaveSubmitting)
          }
          discardConfirmation
        >
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setSuppressSaveBar(true);
              navigate("/app/beats");
            }}
          >
            Discard
          </button>
          <button
            type="button"
            variant="primary"
            disabled={isBusy}
            loading={
              isSaveSubmitting || isSubmittingForm || isUploading
                ? ""
                : undefined
            }
            onClick={() => handleSubmit(status === "draft" ? "draft" : "active")}
          >
            {saveActionLabel}
          </button>
        </SaveBar>

        <form
          id="beat-upload-form"
          onSubmit={handleFormSubmit}
          onReset={handleFormReset}
        >
          <Layout>
            {storageWarning && (
              <Layout.Section>
                <Banner
                  title="Storage warning"
                  tone="warning"
                  action={{ content: "Fix storage", url: "/app/settings" }}
                >
                  <p>{storageWarning}</p>
                </Banner>
              </Layout.Section>
            )}

            {validationBannerMessages.length > 0 && (
              <Layout.Section>
                <Banner
                  title={
                    validationBannerMessages.length === 1
                      ? "There is 1 error with this beat:"
                      : `There are ${validationBannerMessages.length} errors with this beat:`
                  }
                  tone="critical"
                >
                  <ul style={{ margin: 0, paddingLeft: "18px" }}>
                    {validationBannerMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </Banner>
              </Layout.Section>
            )}

            {fetcher.data &&
              "success" in fetcher.data &&
              fetcher.data.success === false && (
                <Layout.Section>
                  <Banner title="Upload failed" tone="critical">
                    <p>
                      {"error" in fetcher.data
                        ? fetcher.data.error
                        : "Upload failed"}
                    </p>
                  </Banner>
                </Layout.Section>
              )}

            {uploadError && (
              <Layout.Section>
                <Banner
                  title="Upload error"
                  tone="critical"
                  onDismiss={() => setUploadError(null)}
                >
                  <p>{uploadError}</p>
                </Banner>
              </Layout.Section>
            )}

            <Layout.Section>
              <BlockStack gap="500">
                {/* Beat Details */}
                <Card>
                  <BlockStack gap="400">
                    <FormLayout>
                      <TextField
                        label="Title"
                        value={title}
                        onChange={setTitle}
                        onBlur={() =>
                          setValidationTouched((current) => ({
                            ...current,
                            title: true,
                          }))
                        }
                        autoComplete="off"
                        error={visibleTitleError}
                      />

                      <FormLayout.Group>
                        <TextField
                          label="BPM"
                          type="number"
                          value={bpm}
                          onChange={setBpm}
                          onBlur={() =>
                            setValidationTouched((current) => ({
                              ...current,
                              bpm: true,
                            }))
                          }
                          autoComplete="off"
                          error={visibleBpmError}
                        />

                        <Select
                          label="Key"
                          options={keyOptions.map((k) => ({
                            label: k,
                            value: k,
                          }))}
                          value={key}
                          onChange={setKey}
                          onBlur={() =>
                            setValidationTouched((current) => ({
                              ...current,
                              key: true,
                            }))
                          }
                          error={visibleKeyError}
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </BlockStack>
                </Card>

                <LicenseFileAssignment
                  licenses={dynamicLicenseTiers}
                  offerGroups={selectedOfferGroups}
                  addableBundles={addableBundles}
                  onAddBundle={handleAddBundle}
                  onAddIndividual={handleOpenOfferPicker}
                  onEditGroup={handleEditOfferGroup}
                  onDeleteGroup={handleDeleteOfferGroup}
                  onDoneEditingGroup={handleDoneEditingOfferGroup}
                  onToggleGroupLicense={handleToggleOfferGroupLicense}
                  onUseLastUsedOffers={
                    hasLastUsedOfferSelection ? handleUseLastUsedOffers : undefined
                  }
                  hasLastUsedOfferSelection={hasLastUsedOfferSelection}
                  offerError={visibleOfferError}
                  previewError={visiblePreviewError}
                  priceErrors={visiblePriceErrors}
                  deliveryErrors={visibleDeliveryErrors}
                  onPriceBlur={(licenseId) =>
                    setValidationTouched((current) => ({
                      ...current,
                      priceByLicenseId: {
                        ...current.priceByLicenseId,
                        [licenseId]: true,
                      },
                    }))
                  }
                  onPreviewInteraction={() =>
                    setValidationTouched((current) => ({
                      ...current,
                      previewFile: true,
                    }))
                  }
                  onDeliveryInteraction={() =>
                    setValidationTouched((current) => ({
                      ...current,
                      deliveryFiles: true,
                    }))
                  }
                  uploadedFiles={uploadedFiles}
                  licenseFiles={licenseFiles}
                  licensePrices={licensePrices}
                  stemsAddonSelections={stemsAddonSelections}
                  previewFile={previewFile}
                  coverArtFile={coverArtFile}
                  onChange={({
                    uploadedFiles: newFiles,
                    licenseFiles: newLicenseFiles,
                    previewFile: newPreviewFile,
                    coverArtFile: newCoverArtFile,
                    licensePrices: newLicensePrices,
                    stemsAddonSelections: newStemsAddonSelections,
                  }) => {
                    setUploadedFiles(newFiles);
                    setLicenseFiles(newLicenseFiles);
                    setPreviewFile(newPreviewFile);
                    setCoverArtFile(newCoverArtFile);
                    setLicensePrices(newLicensePrices);
                    setStemsAddonSelections(newStemsAddonSelections);
                  }}
                  onUpload={handleFileUpload}
                  uploading={isUploading}
                  error={uploadError}
                />
              </BlockStack>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <BlockStack gap="500">
                {/* Status Card */}
                <Card>
                  <BlockStack gap="400">
                    <InlineStatusHeader
                      status={status}
                      isReadyForActive={isReadyForActive()}
                    />
                    <Select
                      label="Status"
                      labelHidden
                      options={[
                        { label: "Active", value: "active" },
                        { label: "Draft", value: "draft" },
                      ]}
                      value={status}
                      onChange={setStatus}
                    />

                    <Text as="p" variant="bodySm" tone="subdued">
                      {status === "draft"
                        ? "Drafts only require a title."
                        : isReadyForActive()
                          ? "Ready to publish to your Shopify store."
                          : "Complete the required fields below before publishing to Shopify."}
                    </Text>
                  </BlockStack>
                </Card>

                {/* Organization Card */}
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      Organization
                    </Text>

                    <FormLayout>
                      <MultiSelectCombobox
                        label="Producers"
                        options={producerOptions}
                        selectedValues={producerGids}
                        onChange={setProducerGids}
                        placeholder="Search producers"
                        onBlur={() =>
                          setValidationTouched((current) => ({
                            ...current,
                            producerGids: true,
                          }))
                        }
                        error={visibleProducerError}
                      />

                      <MultiSelectCombobox
                        label="Genres"
                        options={genreOptions}
                        selectedValues={genreGids}
                        onChange={setGenreGids}
                        placeholder="Search genres"
                        onBlur={() =>
                          setValidationTouched((current) => ({
                            ...current,
                            genreGids: true,
                          }))
                        }
                        error={visibleGenreError}
                      />

                      <ProductTagsField
                        label="Tags"
                        tags={tags}
                        onChange={setTags}
                        placeholder="Add tags"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          </Layout>
        </form>
      </Page>

      <Modal
        open={offerPickerOpen}
        onClose={handleRequestCloseOfferPicker}
        title="Add individual licenses"
        primaryAction={{
          content: "Done",
          onAction: handleApplyOfferPicker,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleCloseOfferPicker,
          },
          ...(selectedLicenseIds.length > 0
            ? [
                {
                  content: "Delete",
                  destructive: true,
                  onAction: () => {
                    setSelectedLicenseIds([]);
                    setOfferPickerOpen(false);
                  },
                },
              ]
            : []),
        ]}
        footer={
          showOfferPickerUnsavedChangesFeedback ? (
            <InlineStack gap="150" blockAlign="center">
              <Icon source={AlertCircleIcon} tone="base" />
              <Text as="p" variant="bodyMd" fontWeight="medium">
                Unsaved changes
              </Text>
            </InlineStack>
          ) : offerPickerHasChanges ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {offerPickerPreviewSelectedLicenses.length} offers will be created
              from this selection.
            </Text>
          ) : undefined
        }
      >
        <Modal.Section>
          <style>
            {`
              @keyframes OfferPickerModal-shake {
                0% { transform: translateX(0); }
                25% { transform: translateX(-4px); }
                50% { transform: translateX(4px); }
                75% { transform: translateX(-2px); }
                100% { transform: translateX(0); }
              }
            `}
          </style>
          <div ref={offerPickerContentRef}>
            <BlockStack gap="300">
              <TextField
                label="Search individual licenses"
                labelHidden
                value={offerPickerSearchValue}
                onChange={setOfferPickerSearchValue}
                autoComplete="off"
                placeholder="Search licenses"
              />

              <Text as="p" variant="bodySm" tone="subdued">
                Choose individual licenses to mix into this beat without
                changing your saved bundles.
              </Text>

              <Scrollable shadow style={{ maxHeight: "50vh" }}>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">
                      Individual licenses
                    </Text>
                    {filteredIndividualLicenses.length > 0 ? (
                      filteredIndividualLicenses.map((license) => (
                        <Box
                          key={license.id}
                          borderWidth="025"
                          borderColor="border"
                          borderRadius="200"
                          padding="300"
                        >
                          <BlockStack gap="150">
                            <Checkbox
                              label={license.licenseName}
                              checked={offerPickerLicenseDraftIds.includes(license.id)}
                              onChange={() => handleToggleOfferPickerLicense(license.id)}
                            />
                            <Text as="p" variant="bodySm" tone="subdued">
                              {license.isStarter ? "Starter license" : "Custom license"}
                              {" • "}
                              {getRequiredDeliveryFormats(license)
                                .map(formatDeliveryFormatLabel)
                                .join(", ")}
                            </Text>
                          </BlockStack>
                        </Box>
                      ))
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        No individual licenses match this search.
                      </Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </div>
        </Modal.Section>
      </Modal>

      <AcknowledgmentModal
        open={showUploadGuardrail}
        title="Before you publish your license offers"
        primaryActionLabel="I understand"
        secondaryActionLabel="Back to home"
        checkboxLabel="I understand that I am responsible for reviewing and approving the license terms I publish."
        checkboxChecked={uploadGuardrailChecked}
        primaryActionLoading={isAcceptingUploadGuardrail}
        onCheckboxChange={setUploadGuardrailChecked}
        onPrimaryAction={handleAcceptUploadGuardrail}
        onClose={handleCloseUploadGuardrail}
      >
        <Text as="p" variant="bodyMd">
          Producer Launchpad gives you ready-to-use music license templates
          built from common industry-standard clauses and your selected
          settings.
        </Text>
        <Text as="p" variant="bodyMd">
          You can customize the business terms to fit your store. We&apos;re
          here to help you publish with confidence, but you&apos;re responsible
          for reviewing and approving the final license terms you offer to
          buyers. Producer Launchpad provides tools and templates, not legal
          advice.
        </Text>
      </AcknowledgmentModal>
    </>
  );
}

function InlineStatusHeader({
  status,
  isReadyForActive,
}: {
  status: string;
  isReadyForActive: boolean;
}) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text variant="headingMd" as="h2">
        Status
      </Text>
      <Badge
        tone={
          status === "draft"
            ? undefined
            : isReadyForActive
              ? "success"
              : "warning"
        }
      >
        {status === "draft" ? "Draft" : isReadyForActive ? "Ready" : "Incomplete"}
      </Badge>
    </InlineStack>
  );
}
