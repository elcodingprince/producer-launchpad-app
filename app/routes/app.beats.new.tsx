import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigate, useNavigation } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import {
  Page,
  Layout,
  Banner,
  Card,
  BlockStack,
  TextField,
  Select,
  Text,
  FormLayout,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { createProductCreatorService } from "../services/productCreator";
import { getAppReadiness } from "~/services/appReadiness.server";
import {
  getStorageConfigForDisplay,
  shouldHardBlockUpload,
  shouldSoftWarnUpload,
} from "~/services/storageConfig.server";
import { uploadDynamicFilesForShop, type DynamicFileUpload, type UploadedFileResult } from "~/services/storageUpload.server";
import {
  LicenseFileAssignment,
  type UploadedFile,
  type LicenseFiles,
} from "../components/LicenseFileAssignment";
import { MultiSelectCombobox } from "../components/MultiSelectCombobox";

const keyOptions = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "D# major", "D# minor",
  "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor",
  "G# major", "G# minor", "A major", "A minor",
  "A# major", "A# minor", "B major", "B minor",
];

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

type DeliveryFormat = "mp3" | "wav" | "stems";

const DELIVERY_FORMAT_ORDER: DeliveryFormat[] = ["mp3", "wav", "stems"];

function normalizeDeliveryFormat(value: string): DeliveryFormat | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mp3") return "mp3";
  if (normalized === "wav") return "wav";
  if (
    normalized === "stems" ||
    normalized === "stems zip" ||
    normalized === "zip"
  ) {
    return "stems";
  }
  return null;
}

function getRequiredDeliveryFormats(license: {
  fileFormats?: string;
  includesStems?: boolean;
}): DeliveryFormat[] {
  const selected = new Set<DeliveryFormat>();

  String(license.fileFormats || "")
    .split(",")
    .map((format) => normalizeDeliveryFormat(format))
    .filter((format): format is DeliveryFormat => Boolean(format))
    .forEach((format) => selected.add(format));

  if (license.includesStems) {
    selected.add("stems");
  }

  return DELIVERY_FORMAT_ORDER.filter((format) => selected.has(format));
}

function formatDeliveryFormatLabel(format: DeliveryFormat) {
  return format === "stems" ? "STEMS ZIP" : format.toUpperCase();
}

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  };
}

function serializeUploadedFiles(files: UploadedFile[]) {
  return files.map((file) => serializeUploadedFile(file));
}

function isLicenseDeliveryFile(file: UploadedFile) {
  return file.purpose === "mp3" || file.purpose === "wav" || file.purpose === "stems";
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
    const [licenses, genres, producers] = await Promise.all([
      productService.getLicenseMetaobjects(),
      productService.getGenreMetaobjects(),
      productService.getProducerMetaobjects(),
    ]);

    if (producers.length === 0) {
      return redirect(readiness.onboardingRoute);
    }

    const draftRecord = draftId
      ? await prisma.beatDraft.findFirst({
          where: {
            id: draftId,
            shop: session.shop,
          },
        })
      : null;

    return json({
      licenses,
      genres,
      producers,
      draft: draftRecord
        ? {
            id: draftRecord.id,
            title: draftRecord.title,
            bpm: draftRecord.bpm ? String(draftRecord.bpm) : "",
            key: draftRecord.key || "C minor",
            producerAlias: draftRecord.producerAlias || "",
            genreGids: parseJsonField<string[]>(draftRecord.genreGidsJson, []),
            producerGids: parseJsonField<string[]>(draftRecord.producerGidsJson, []),
            licenseFiles: parseJsonField<LicenseFiles>(draftRecord.licenseFilesJson, {}),
            licensePrices: parseJsonField<Record<string, string>>(draftRecord.licensePricesJson, {}),
            uploadedFiles: parseJsonField<UploadedFile[]>(draftRecord.uploadedFilesJson, []),
            previewFile: parseJsonField<UploadedFile | null>(draftRecord.previewFileJson, null),
            coverArtFile: parseJsonField<UploadedFile | null>(draftRecord.coverArtFileJson, null),
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
        genres: [],
        producers: [],
        draft: null,
        storageWarning: null,
        error: error instanceof Error ? error.message : "Failed to load upload page",
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const storageConfig = await getStorageConfigForDisplay(session.shop);

  if (shouldHardBlockUpload(storageConfig)) {
    return redirect("/app/settings");
  }

  try {
    console.info("[upload] started");
    const productService = createProductCreatorService(session, admin);

    // Parse multipart form data to get actual File objects
    const formData = await request.formData();
    
    // Extract beat details
    const title = formData.get("title") as string;
    const bpm = parseInt(formData.get("bpm") as string, 10);
    const key = formData.get("key") as string;
    const genreGids = JSON.parse((formData.get("genreGids") as string) || "[]");
    const producerGids = JSON.parse((formData.get("producerGids") as string) || "[]");
    const producerAlias = (formData.get("producerAlias") as string) || "";
    const statusValue = (formData.get("status") as string) || "active";
    const productStatus = statusValue === "draft" ? "DRAFT" : "ACTIVE";
    const isDraft = productStatus === "DRAFT";
    const draftId = (formData.get("draftId") as string) || null;
    const coverArtFileId = (formData.get("coverArtFileId") as string) || null;

    // Extract license file assignments (maps tier -> array of temp file IDs)
    const licenseFilesData = JSON.parse((formData.get("licenseFiles") as string) || "{}");
    const licensePricesData = JSON.parse((formData.get("licensePrices") as string) || "{}");
    const uploadedFilesStateRaw = formData.get("uploadedFilesState") as string | null;
    const uploadedFilesState = parseJsonField<UploadedFile[]>(
      uploadedFilesStateRaw || "[]",
      [],
    );
    
    // Extract preview file ID
    const previewFileId = formData.get("previewFileId") as string | null;
    
    // Extract file metadata (maps temp file ID -> metadata including purpose)
    const fileMetadataJson = (formData.get("fileMetadata") as string) || "{}";
    const fileMetadata = JSON.parse(fileMetadataJson);

    const existingDraft = draftId
      ? await prisma.beatDraft.findFirst({
          where: {
            id: draftId,
            shop: session.shop,
          },
        })
      : null;

    const savedDraftUploadedFiles = existingDraft
      ? parseJsonField<UploadedFile[]>(existingDraft.uploadedFilesJson, [])
      : [];
    const existingUploadedFiles =
      uploadedFilesStateRaw !== null
        ? uploadedFilesState
            .map((file) =>
              savedDraftUploadedFiles.find((savedFile) => savedFile.id === file.id) || file,
            )
            .filter(isLicenseDeliveryFile)
        : savedDraftUploadedFiles;
    const existingPreviewFile = existingDraft
      ? parseJsonField<UploadedFile | null>(existingDraft.previewFileJson, null)
      : null;
    const existingCoverArtFile = existingDraft
      ? parseJsonField<UploadedFile | null>(existingDraft.coverArtFileJson, null)
      : null;
    const existingFilesById = new Map(
      dedupeFilesById([
        ...existingUploadedFiles,
        existingPreviewFile,
        existingCoverArtFile,
      ]).map((file) => [file.id, file]),
    );

    // === SERVER-SIDE VALIDATION ===
    
    const hasRequiredMetadata =
      Boolean(title) &&
      Boolean(bpm) &&
      Boolean(key) &&
      genreGids.length > 0 &&
      producerGids.length > 0;

    // Validate required fields
    if ((!isDraft && !hasRequiredMetadata) || (isDraft && !title)) {
      return json(
        {
          success: false,
          error: isDraft
            ? "Add a beat title before saving this draft"
            : "Please fill in all required fields",
        },
        { status: 400 }
      );
    }

    // Validate preview file exists for active beats
    if (!isDraft && !previewFileId) {
      return json(
        { success: false, error: "Please upload a preview audio file" },
        { status: 400 }
      );
    }

    // Get actual license GIDs from the database
    const dbLicenses = await productService.getLicenseMetaobjects();
    const licenseTiers = dbLicenses.map(l => l.licenseId);

    // Validate each license tier has the full package its template promises
    const missingAssignments: string[] = [];

    if (!isDraft) {
      for (const license of dbLicenses) {
        const filesForTier = licenseFilesData[license.licenseId];
        const requiredFormats = getRequiredDeliveryFormats(license);

        if (!filesForTier || !Array.isArray(filesForTier) || filesForTier.length === 0) {
          missingAssignments.push(
            `${license.licenseName}: ${requiredFormats.map(formatDeliveryFormatLabel).join(", ") || "package files"}`,
          );
          continue;
        }

        const assignedFormats = new Set(
          filesForTier
            .map((fileId: string) =>
              fileMetadata[fileId]?.purpose ||
              fileMetadata[fileId]?.type ||
              existingFilesById.get(fileId)?.purpose ||
              existingFilesById.get(fileId)?.type ||
              "",
            )
            .map((format: string) => normalizeDeliveryFormat(format))
            .filter((format: DeliveryFormat | null): format is DeliveryFormat => Boolean(format))
        );

        const missingFormats = requiredFormats.filter((format) => !assignedFormats.has(format));
        if (missingFormats.length > 0) {
          missingAssignments.push(
            `${license.licenseName}: ${missingFormats.map(formatDeliveryFormatLabel).join(", ")}`,
          );
        }
      }
    }

    if (missingAssignments.length > 0) {
      return json(
        {
          success: false,
          error: `Some license packages are missing required files. ${missingAssignments.join(" | ")}`,
        },
        { status: 400 }
      );
    }

    // Collect all file entries from formData
    const fileEntries: Array<{ tempId: string; file: File; purpose: string }> = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        const tempId = key.replace("file_", "");
        const metadata = fileMetadata[tempId] || {};
        fileEntries.push({ tempId, file: value, purpose: metadata.purpose || "other" });
      }
    }

    if (!isDraft && fileEntries.length === 0 && existingFilesById.size === 0) {
      return json(
        { success: false, error: "No files were uploaded" },
        { status: 400 }
      );
    }

    // Validate that any assigned files actually exist in the current upload payload
    const allAssignedFileIds = new Set<string>();
    if (previewFileId) {
      allAssignedFileIds.add(previewFileId);
    }
    for (const tier of licenseTiers) {
      const filesForTier = licenseFilesData[tier] || [];
      for (const fileId of filesForTier) {
        allAssignedFileIds.add(fileId);
      }
    }

    const uploadedTempIds = new Set(fileEntries.map(e => e.tempId));
    const knownFileIds = new Set([
      ...uploadedTempIds,
      ...existingFilesById.keys(),
    ]);
    const missingFiles = Array.from(allAssignedFileIds).filter(id => !knownFileIds.has(id));

    if (!isDraft && missingFiles.length > 0) {
      return json(
        {
          success: false,
          error: `Some assigned files were not found in the upload. Please re-upload the files.`,
        },
        { status: 400 }
      );
    }

    const producers = await productService.getProducerMetaobjects();
    const selectedProducers = producers.filter((p) => producerGids.includes(p.id));
    const producerNames = selectedProducers.map((p) => p.name);

    // Generate beat slug for storage path
    const beatSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // === UPLOAD FILES TO STORAGE ===
    console.info("[upload] uploading files to configured storage");

    // Prepare files for upload with their purpose
    const filesToUpload: DynamicFileUpload[] = fileEntries.map(entry => {
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
      });
    }

    // Track cover art and preview URLs by purpose
    let coverArtUrl: string | undefined;
    let previewUrl: string | undefined;
    
    // Upload cover art to Shopify's CDN directly to prevent "Media processing failed" timeouts
    const coverEntry = fileEntries.find(e => e.purpose === "cover" || e.file.type.startsWith('image/'));
    let shopifyCoverResourceUrl: string | undefined;

    if (coverEntry) {
      console.info("[upload] uploading cover art directly to Shopify CDN via stagedUploadsCreate");
      try {
        shopifyCoverResourceUrl = await productService.uploadImageToShopify(coverEntry.file);
      } catch (err) {
        console.error("Failed to upload cover art to Shopify:", err);
      }
    }

    const mergedPreviewFile = previewFileId
      ? uploadedFilesWithStorage.get(previewFileId) || existingFilesById.get(previewFileId) || null
      : null;
    const mergedCoverArtFile = coverArtFileId
      ? uploadedFilesWithStorage.get(coverArtFileId) || existingFilesById.get(coverArtFileId) || null
      : null;

    const mergedLicenseFilePoolByPurpose = new Map<string, UploadedFile>();
    [...existingUploadedFiles, ...Array.from(uploadedFilesWithStorage.values()).filter(isLicenseDeliveryFile)].forEach((file) => {
      const purposeKey = isLicenseDeliveryFile(file) ? file.purpose : file.id;
      mergedLicenseFilePoolByPurpose.set(purposeKey, file);
    });
    const mergedUploadedFiles = Array.from(mergedLicenseFilePoolByPurpose.values());

    previewUrl = mergedPreviewFile?.storageUrl;
    coverArtUrl = mergedCoverArtFile?.storageUrl;

    if (isDraft) {
      const draftData = {
        shop: session.shop,
        title,
        bpm: bpm || null,
        key: key || null,
        producerAlias: producerAlias || null,
        genreGidsJson: JSON.stringify(genreGids),
        producerGidsJson: JSON.stringify(producerGids),
        licenseFilesJson: JSON.stringify(licenseFilesData),
        licensePricesJson: JSON.stringify(licensePricesData),
        uploadedFilesJson: JSON.stringify(mergedUploadedFiles),
        previewFileJson: mergedPreviewFile ? JSON.stringify(mergedPreviewFile) : null,
        coverArtFileJson: mergedCoverArtFile ? JSON.stringify(mergedCoverArtFile) : null,
      };

      const savedDraft = existingDraft
        ? await prisma.beatDraft.update({
            where: { id: existingDraft.id },
            data: draftData,
          })
        : await prisma.beatDraft.create({
            data: draftData,
          });

      console.info("[upload] draft saved successfully", { draftId: savedDraft.id });
      return redirect("/app/beats?success=true&status=draft");
    }

    // Get actual license GIDs from the database
    const licenses = dbLicenses;
    const licenseMap = new Map(licenses.map((l) => [l.licenseId, l.id]));

    // === CREATE SHOPIFY PRODUCT ===
    console.info("[upload] creating Shopify product");
    
    // Prepare license prices
    const licensePrices = licenses.map(lp => {
      const customPriceStr = licensePricesData[lp.licenseId];
      const customPrice = customPriceStr ? parseFloat(customPriceStr) : 0;
      return {
        licenseId: lp.licenseId,
        licenseGid: lp.id,
        licenseName: lp.licenseName,
        price: isNaN(customPrice) ? 0 : customPrice,
        compareAtPrice: undefined,
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
      licenses: licensePrices,
      coverArtUrl: shopifyCoverResourceUrl || coverArtUrl,
      previewUrl,
    });

    // === SAVE FILE MAPPINGS TO DATABASE ===
    console.info("[upload] saving file mappings to database", { productId: result.productId });
    
    const productId = result.productId;
    
    // Create BeatFile records for each uploaded file
    const beatFileRecords: Array<{ id: string; tempId: string }> = [];

    const allPersistedFiles = dedupeFilesById([
      ...mergedUploadedFiles,
      mergedPreviewFile,
      mergedCoverArtFile,
    ]).filter((file) => file.storageUrl);

    for (const file of allPersistedFiles) {
      const sizeInBytes =
        typeof file.size === "number"
          ? file.size
          : Math.round(parseFloat(String(file.size).replace(/[^\d.]/g, "")) * (String(file.size).includes("MB") ? 1024 * 1024 : String(file.size).includes("KB") ? 1024 : 1));

      const beatFile = await prisma.beatFile.create({
        data: {
          beatId: productId,
          filename: file.name,
          storageUrl: file.storageUrl!,
          fileType: file.type,
          filePurpose: file.purpose,
          size: sizeInBytes,
        },
      });
      
      beatFileRecords.push({ id: beatFile.id, tempId: file.id });
    }
    
    // Create a map from tempId to database BeatFile id
    const tempIdToDbId = new Map(beatFileRecords.map(r => [r.tempId, r.id]));
    
    const licenseIdToVariantId = new Map(
      result.variants
        .filter((variant) => variant.id && variant.licenseId)
        .map((variant) => [variant.licenseId, variant.id])
    );

    // Create LicenseFileMapping records for each created Shopify variant
    for (const tier of licenseTiers) {
      const variantId = licenseIdToVariantId.get(tier);
      if (!variantId) {
        throw new Error(`Missing Shopify variant mapping for license tier "${tier}"`);
      }
      const normalizedVariantId = normalizeShopifyResourceId(variantId);

      const tempFileIdsForTier = licenseFilesData[tier] || [];
      
      for (let sortOrder = 0; sortOrder < tempFileIdsForTier.length; sortOrder++) {
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

    console.info("[upload] completed successfully", { productId: result.productId });
    return redirect(`/app/beats?success=true&status=${statusValue}`);
  } catch (error) {
    console.error("Upload error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
};

export default function NewBeatPage() {
  const { licenses, genres, producers, draft, storageWarning, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const initialTitle = draft?.title || "";
  const initialBpm = draft?.bpm || "";
  const initialKey = draft?.key || "C minor";
  const initialGenreGids =
    draft?.genreGids?.length ? draft.genreGids : (genres[0]?.id ? [genres[0].id] : []);
  const initialProducerGids =
    draft?.producerGids?.length ? draft.producerGids : (producers[0]?.id ? [producers[0].id] : []);
  const initialProducerAlias = draft?.producerAlias || "";
  const initialStatus = draft ? "draft" : "active";
  const initialUploadedFiles = draft?.uploadedFiles || [];
  const initialLicenseFiles = useMemo(() => {
    const obj: LicenseFiles = draft?.licenseFiles || {};
    if (licenses) licenses.filter(Boolean).forEach((l) => (obj[l!.licenseId] = obj[l!.licenseId] || []));
    return obj;
  }, [draft?.licenseFiles, licenses]);
  const initialLicensePrices = useMemo(() => {
    const obj: Record<string, string> = draft?.licensePrices || {};
    if (licenses) licenses.filter(Boolean).forEach((l) => (obj[l!.licenseId] = obj[l!.licenseId] || ""));
    return obj;
  }, [draft?.licensePrices, licenses]);
  const initialPreviewFile = draft?.previewFile || null;
  const initialCoverArtFile = draft?.coverArtFile || null;

  // Form state
  const [title, setTitle] = useState(initialTitle);
  const [bpm, setBpm] = useState(initialBpm);
  const [key, setKey] = useState(initialKey);
  const [genreGids, setGenreGids] = useState<string[]>(initialGenreGids);
  const [producerGids, setProducerGids] = useState<string[]>(initialProducerGids);
  const [producerAlias, setProducerAlias] = useState(initialProducerAlias);
  const [status, setStatus] = useState(initialStatus);

  // License file assignment state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(initialUploadedFiles);
  const [licenseFiles, setLicenseFiles] = useState<LicenseFiles>(initialLicenseFiles);
  const [licensePrices, setLicensePrices] = useState<Record<string, string>>(initialLicensePrices);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(initialPreviewFile);
  const [coverArtFile, setCoverArtFile] = useState<UploadedFile | null>(initialCoverArtFile);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handle file upload with purpose
  const handleFileUpload = useCallback(
    async (files: File[], purpose: 'preview' | 'license'): Promise<UploadedFile[]> => {
      setIsUploading(true);
      setUploadError(null);

      try {
        // Create local file entries with temporary IDs and purpose
        const newFiles: UploadedFile[] = files.map((file) => {
          const fileType = detectFileType(file.name);
          return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: purpose === 'preview' ? 'preview' : fileType,
            purpose: purpose === 'preview' ? 'preview' : (fileType === 'mp3' || fileType === 'wav' || fileType === 'stems' ? fileType : 'other'),
            size: formatFileSize(file.size),
            file: file,
          };
        });

        return newFiles;
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed");
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    []
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

  const hasDraftMinimumFields = () => Boolean(title.trim());

  const hasRequiredBeatFields = () =>
    Boolean(
      title &&
      bpm &&
      key &&
      genreGids.length > 0 &&
      producerGids.length > 0,
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
        status: initialStatus,
        uploadedFiles: serializeUploadedFiles(initialUploadedFiles),
        licenseFiles: initialLicenseFiles,
        licensePrices: initialLicensePrices,
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
      initialPreviewFile,
      initialProducerAlias,
      initialProducerGids,
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
        status,
        uploadedFiles: serializeUploadedFiles(uploadedFiles),
        licenseFiles,
        licensePrices,
        previewFile: serializeUploadedFile(previewFile),
        coverArtFile: serializeUploadedFile(coverArtFile),
      }),
    [
      bpm,
      coverArtFile,
      genreGids,
      key,
      licenseFiles,
      licensePrices,
      previewFile,
      producerAlias,
      producerGids,
      status,
      title,
      uploadedFiles,
    ],
  );

  const isDirty = initialSnapshot !== currentSnapshot;
  const isSubmittingForm = navigation.state !== "idle";
  const isSaveBarOpen = isDirty && !isSubmittingForm;

  const isReadyForActive = () => {
    const hasAllLicenseFiles = licenses.filter(Boolean).every((license) => {
      const requiredFormats = getRequiredDeliveryFormats(license!);
      const assignedFileIds = licenseFiles[license!.licenseId] || [];
      const assignedFormats = new Set(
        assignedFileIds
          .map((fileId) => uploadedFiles.find((file) => file.id === fileId)?.purpose || "")
          .map((format) => normalizeDeliveryFormat(format))
          .filter((format): format is DeliveryFormat => Boolean(format))
      );

      return requiredFormats.every((format) => assignedFormats.has(format));
    });

    return hasRequiredBeatFields() && previewFile && hasAllLicenseFiles;
  };

  const effectiveSaveMode = status === "active" && isReadyForActive() ? "active" : "draft";
  const saveActionLabel =
    effectiveSaveMode === "active"
      ? isUploading
        ? "Saving beat..."
        : "Save beat"
      : isUploading
        ? "Saving draft..."
        : "Save draft";

  const resetFormState = useCallback(() => {
    setTitle(initialTitle);
    setBpm(initialBpm);
    setKey(initialKey);
    setGenreGids(initialGenreGids);
    setProducerGids(initialProducerGids);
    setProducerAlias(initialProducerAlias);
    setStatus(initialStatus);
    setUploadedFiles(initialUploadedFiles);
    setLicenseFiles(initialLicenseFiles);
    setLicensePrices(initialLicensePrices);
    setPreviewFile(initialPreviewFile);
    setCoverArtFile(initialCoverArtFile);
    setUploadError(null);
  }, [
    initialBpm,
    initialCoverArtFile,
    initialGenreGids,
    initialKey,
    initialLicenseFiles,
    initialLicensePrices,
    initialPreviewFile,
    initialProducerAlias,
    initialProducerGids,
    initialStatus,
    initialTitle,
    initialUploadedFiles,
  ]);

  // Handle form submission
  const handleSubmit = (saveMode?: "draft" | "active") => {
    const resolvedStatus = saveMode || effectiveSaveMode;
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
    formData.append("status", resolvedStatus);
    formData.append("licenseFiles", JSON.stringify(licenseFiles));
    formData.append("licensePrices", JSON.stringify(licensePrices));
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

    submit(formData, { method: "post", encType: "multipart/form-data" });
  };

  // Map licenses to tier format for LicenseFileAssignment
  const dynamicLicenseTiers = licenses.filter(Boolean).map(l => ({
    id: l!.licenseId,
    name: l!.licenseName,
    price: licensePrices[l!.licenseId] ? `$${licensePrices[l!.licenseId]}` : "Not set",
    description: l!.displayName,
    packageFormats: getRequiredDeliveryFormats(l!),
  }));

  const genreOptions = genres.filter(Boolean).map((g) => ({
    label: g!.title,
    value: g!.id,
  }));

  const producerOptions = producers.filter(Boolean).map((p) => ({
    label: p!.name,
    value: p!.id,
  }));

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

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isUploading) return;
    handleSubmit(effectiveSaveMode);
  };

  const handleFormReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isUploading) return;
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

  return (
    <Page 
      title="Upload beat"
      backAction={{ content: "Beats", onAction: handleBackAction }}
    >
      <SaveBar id="beat-upload-save-bar" open={isSaveBarOpen} discardConfirmation>
        <button
          type="reset"
          form="beat-upload-form"
          disabled={isUploading}
        >
          Discard
        </button>
        <button
          type="submit"
          form="beat-upload-form"
          variant="primary"
          disabled={isUploading || (effectiveSaveMode === "draft" ? !hasDraftMinimumFields() : !hasRequiredBeatFields())}
        >
          {saveActionLabel}
        </button>
      </SaveBar>

      <form id="beat-upload-form" onSubmit={handleFormSubmit} onReset={handleFormReset}>
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

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Upload failed" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {uploadError && (
          <Layout.Section>
            <Banner title="Upload error" tone="critical" onDismiss={() => setUploadError(null)}>
              <p>{uploadError}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="500">
            {/* Beat Details */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Beat details
                </Text>

                <FormLayout>
                  <TextField
                    label={<span>Beat title <Text as="span" tone="subdued">(required)</Text></span>}
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                    helpText="Enter a catchy title for your beat"
                  />

                  <FormLayout.Group>
                    <TextField
                      label={<span>BPM <Text as="span" tone="subdued">(required)</Text></span>}
                      type="number"
                      value={bpm}
                      onChange={setBpm}
                      autoComplete="off"
                      helpText="Beats per minute"
                    />

                    <Select
                      label={<span>Key <Text as="span" tone="subdued">(required)</Text></span>}
                      options={keyOptions.map((k) => ({ label: k, value: k }))}
                      value={key}
                      onChange={setKey}
                    />
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>

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
                  />

                  <TextField
                    label="Producer alias (optional)"
                    value={producerAlias}
                    onChange={setProducerAlias}
                    autoComplete="off"
                    helpText="Alternative name to display"
                  />

                  <MultiSelectCombobox
                    label="Genres"
                    options={genreOptions}
                    selectedValues={genreGids}
                    onChange={setGenreGids}
                    placeholder="Search genres"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            <LicenseFileAssignment
              licenses={dynamicLicenseTiers}
              uploadedFiles={uploadedFiles}
              licenseFiles={licenseFiles}
              licensePrices={licensePrices}
              previewFile={previewFile}
              coverArtFile={coverArtFile}
              onChange={({
                uploadedFiles: newFiles,
                licenseFiles: newLicenseFiles,
                previewFile: newPreviewFile,
                coverArtFile: newCoverArtFile,
                licensePrices: newLicensePrices,
              }) => {
                setUploadedFiles(newFiles);
                setLicenseFiles(newLicenseFiles);
                setPreviewFile(newPreviewFile);
                setCoverArtFile(newCoverArtFile);
                setLicensePrices(newLicensePrices);
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
                <Text variant="headingMd" as="h2">
                  Status
                </Text>
                <Select
                  label="Status"
                  labelHidden
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Draft", value: "draft" }
                  ]}
                  value={status}
                  onChange={setStatus}
                />

                <Text as="p" variant="bodySm" tone="subdued">
                  Drafts stay inside Producer Launchpad until you activate them. Active beats publish to Shopify when files, preview audio, and pricing are ready.
                </Text>

                {status === "draft" ? (
                  <Banner tone="info">
                    <p>This beat will stay in your Drafts tab until you save it as active.</p>
                  </Banner>
                ) : !isReadyForActive() ? (
                  <Banner tone="warning">
                    <p>This beat will save as a draft until preview audio, delivery packages, and pricing are complete.</p>
                  </Banner>
                ) : (
                  <Banner tone="success">
                    <p>This beat is ready to save as active.</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
      </form>
    </Page>
  );
}
