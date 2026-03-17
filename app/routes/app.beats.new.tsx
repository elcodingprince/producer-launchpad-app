import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
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
  ChoiceList,
  Button,
  Text,
  FormLayout,
} from "@shopify/polaris";
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
import { UploadIcon } from "@shopify/polaris-icons";

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



export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const productService = createProductCreatorService(session, admin);

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

    return json({
      licenses,
      genres,
      producers,
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

    // Extract license file assignments (maps tier -> array of temp file IDs)
    const licenseFilesData = JSON.parse((formData.get("licenseFiles") as string) || "{}");
    const licensePricesData = JSON.parse((formData.get("licensePrices") as string) || "{}");
    
    // Extract preview file ID
    const previewFileId = formData.get("previewFileId") as string | null;
    
    // Extract file metadata (maps temp file ID -> metadata including purpose)
    const fileMetadataJson = (formData.get("fileMetadata") as string) || "{}";
    const fileMetadata = JSON.parse(fileMetadataJson);

    // === SERVER-SIDE VALIDATION ===
    
    // Validate required fields
    if (!title || !bpm || !key || genreGids.length === 0 || producerGids.length === 0) {
      return json(
        { success: false, error: "Please fill in all required fields" },
        { status: 400 }
      );
    }

    // Validate preview file exists
    if (!previewFileId) {
      return json(
        { success: false, error: "Please upload a preview audio file" },
        { status: 400 }
      );
    }

    // Get actual license GIDs from the database
    const dbLicenses = await productService.getLicenseMetaobjects();
    const licenseTiers = dbLicenses.map(l => l.licenseId);
    
    // Validate each license tier has at least one file
    const missingAssignments: string[] = [];
    
    for (const tier of licenseTiers) {
      const filesForTier = licenseFilesData[tier];
      if (!filesForTier || !Array.isArray(filesForTier) || filesForTier.length === 0) {
        missingAssignments.push(tier);
      }
    }

    if (missingAssignments.length > 0) {
      return json(
        {
          success: false,
          error: `Each license tier must have at least one file assigned. Missing: ${missingAssignments.join(", ")}`,
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

    if (fileEntries.length === 0) {
      return json(
        { success: false, error: "No files were uploaded" },
        { status: 400 }
      );
    }

    // Validate that all assigned files exist in uploads
    const allAssignedFileIds = new Set<string>();
    allAssignedFileIds.add(previewFileId); // Preview is also required
    for (const tier of licenseTiers) {
      const filesForTier = licenseFilesData[tier] || [];
      for (const fileId of filesForTier) {
        allAssignedFileIds.add(fileId);
      }
    }

    const uploadedTempIds = new Set(fileEntries.map(e => e.tempId));
    const missingFiles = Array.from(allAssignedFileIds).filter(id => !uploadedTempIds.has(id));
    
    if (missingFiles.length > 0) {
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
    const uploadResults = await uploadDynamicFilesForShop(session.shop, filesToUpload, beatSlug);
    
    // Create a map from tempId to upload result
    const tempIdToResult = new Map<string, UploadedFileResult>();
    for (let i = 0; i < fileEntries.length; i++) {
      tempIdToResult.set(fileEntries[i].tempId, uploadResults[i]);
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

    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      const result = uploadResults[i];
      
      if (entry.purpose === "preview" || entry.tempId === previewFileId) {
        previewUrl = result.storageUrl;
      }
      if (entry.purpose === "cover" || result.fileType === "cover") {
        coverArtUrl = result.storageUrl;
      }
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
    
    for (const entry of fileEntries) {
      const uploadResult = tempIdToResult.get(entry.tempId);
      const metadata = fileMetadata[entry.tempId] || {};
      
      if (!uploadResult) continue;
      
      const beatFile = await prisma.beatFile.create({
        data: {
          beatId: productId,
          filename: metadata.name || uploadResult.originalName,
          storageUrl: uploadResult.storageUrl,
          fileType: uploadResult.fileType,
          filePurpose: metadata.purpose || entry.purpose || uploadResult.fileType,
          size: uploadResult.size,
        },
      });
      
      beatFileRecords.push({ id: beatFile.id, tempId: entry.tempId });
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

    console.info("[upload] completed successfully", { productId: result.productId });
    return redirect("/app/beats?success=true");
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
  const { licenses, genres, producers, storageWarning, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  // Form state
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("C minor");
  const [genreGids, setGenreGids] = useState<string[]>(genres[0]?.id ? [genres[0].id] : []);
  const [producerGids, setProducerGids] = useState<string[]>(producers[0]?.id ? [producers[0].id] : []);
  const [producerAlias, setProducerAlias] = useState("");
  const [status, setStatus] = useState("active");

  // License file assignment state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [licenseFiles, setLicenseFiles] = useState<LicenseFiles>(() => {
    const obj: LicenseFiles = {};
    if (licenses) licenses.filter(Boolean).forEach(l => obj[l!.licenseId] = []);
    return obj;
  });
  const [licensePrices, setLicensePrices] = useState<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    if (licenses) licenses.filter(Boolean).forEach(l => obj[l!.licenseId] = "");
    return obj;
  });
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<UploadedFile | null>(null);
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

  // Check if form is valid
  const isFormValid = () => {
    const hasAllLicenseFiles = licenses.filter(Boolean).every(l => licenseFiles[l!.licenseId] && licenseFiles[l!.licenseId].length > 0);
    return (
      title &&
      bpm &&
      key &&
      genreGids.length > 0 &&
      producerGids.length > 0 &&
      previewFile &&
      hasAllLicenseFiles
    );
  };

  // Handle form submission
  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("bpm", bpm);
    formData.append("key", key);
    formData.append("genreGids", JSON.stringify(genreGids));
    formData.append("producerGids", JSON.stringify(producerGids));
    formData.append("producerAlias", producerAlias);
    formData.append("status", status);
    formData.append("licenseFiles", JSON.stringify(licenseFiles));
    formData.append("licensePrices", JSON.stringify(licensePrices));
    
    // Add preview file ID
    if (previewFile) {
      formData.append("previewFileId", previewFile.id);
    }

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
    description: l!.displayName
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

  return (
    <Page 
      title="Upload beat"
      backAction={{ content: "Beats", url: "/app/beats" }}
      primaryAction={{
        content: isUploading ? "Uploading..." : "Upload beat",
        onAction: handleSubmit,
        disabled: !isFormValid() || isUploading,
      }}
    >
      <Layout>
        {storageWarning && (
          <Layout.Section>
            <Banner
              title="Storage warning"
              tone="warning"
              action={{ content: "Fix storage", url: "/app/storage" }}
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
                
                {!isFormValid() && (
                  <Banner tone="warning">
                    <p>There are missing audio files or required fields. Please complete all requirements before publishing.</p>
                  </Banner>
                )}
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
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
