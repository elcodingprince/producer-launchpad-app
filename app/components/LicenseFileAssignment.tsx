import { useState, useCallback, useRef, memo } from "react";
import {
  Card,
  Button,
  DropZone,
  InlineStack,
  BlockStack,
  Text,
  Banner,
  Spinner,
  Icon,
  Box,
  TextField,
} from "@shopify/polaris";
import {
  XIcon,
  AlertDiamondIcon,
  StarFilledIcon,
  CheckCircleIcon,
  ImageIcon,
  PlusIcon,
} from "@shopify/polaris-icons";
import { validateUploadFile, ALLOWED_FILE_TYPES } from "../services/bunnyCdn";
import { FileFormatBadge, getFileFormatLabel } from "./FileFormatBadge";
import {
  licenseOffersStems,
  stemsAvailableAsAddon,
  stemsIncludedByDefault,
} from "../services/deliveryPackages";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LicenseTier {
  id: string;
  name: string;
  price: string;
  description?: string;
  color?: string;
  packageFormats?: Array<"mp3" | "wav" | "stems">;
  stemsPolicy?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: "mp3" | "wav" | "stems" | "cover" | "preview" | "other";
  purpose:
    | "preview"
    | "mp3"
    | "wav"
    | "stems"
    | "cover"
    | "license_pdf"
    | "other";
  size: string;
  file?: File;
  storageUrl?: string;
  shopifyResourceUrl?: string;
}

export interface LicenseFiles {
  [tierId: string]: string[];
}

export interface LicenseFileAssignmentProps {
  licenses: LicenseTier[];
  uploadedFiles?: UploadedFile[];
  licenseFiles?: LicenseFiles;
  licensePrices?: Record<string, string>;
  previewFile?: UploadedFile | null;
  coverArtFile?: UploadedFile | null;
  onChange?: (data: {
    uploadedFiles: UploadedFile[];
    licenseFiles: LicenseFiles;
    previewFile: UploadedFile | null;
    coverArtFile: UploadedFile | null;
    licensePrices: Record<string, string>;
  }) => void;
  onUpload?: (
    files: File[],
    purpose: "preview" | "license",
  ) => Promise<UploadedFile[]>;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

// ── Tier styles ──────────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<
  string,
  { icon: any; tint: "info" | "warning"; recommendedFiles: string[] }
> = {
  basic: { icon: AlertDiamondIcon, tint: "info", recommendedFiles: ["mp3"] },
  premium: {
    icon: AlertDiamondIcon,
    tint: "info",
    recommendedFiles: ["mp3", "wav"],
  },
  unlimited: {
    icon: StarFilledIcon,
    tint: "warning",
    recommendedFiles: ["mp3", "wav", "stems"],
  },
};

const getTierMeta = (tier: LicenseTier) => {
  const d = TIER_DEFAULTS[tier.id.toLowerCase()] || {
    icon: CheckCircleIcon,
    tint: "info",
    recommendedFiles: [],
  };
  return {
    icon: d.icon,
    tint: d.tint,
    recommendedFiles: tier.packageFormats?.length
      ? tier.packageFormats
      : d.recommendedFiles,
  };
};

// ── Component ────────────────────────────────────────────────────────────────

export function LicenseFileAssignment({
  licenses,
  uploadedFiles: externalFiles,
  licenseFiles: externalLicenseFiles,
  licensePrices: externalLicensePrices,
  previewFile: externalPreviewFile,
  coverArtFile: externalCoverArtFile,
  onChange,
  onUpload,
  uploading = false,
  uploadProgress,
  error,
}: LicenseFileAssignmentProps) {
  const licenseFilesInputRef = useRef<HTMLInputElement>(null);

  const [internalFiles, setInternalFiles] = useState<UploadedFile[]>([]);
  const [internalLicenseFiles, setInternalLicenseFiles] =
    useState<LicenseFiles>({ basic: [], premium: [], unlimited: [] });
  const [internalLicensePrices, setInternalLicensePrices] = useState<
    Record<string, string>
  >({ basic: "29.99", premium: "49.99", unlimited: "99.99" });
  const [internalPreviewFile, setInternalPreviewFile] =
    useState<UploadedFile | null>(null);
  const [internalCoverArtFile, setInternalCoverArtFile] =
    useState<UploadedFile | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<
    Array<{ file: File; error: string }>
  >([]);
  const [coverArtPreviewUrl, setCoverArtPreviewUrl] = useState<string | null>(
    null,
  );

  const uploadedFiles = externalFiles ?? internalFiles;
  const licenseFiles = externalLicenseFiles ?? internalLicenseFiles;
  const licensePrices = externalLicensePrices ?? internalLicensePrices;
  const previewFile = externalPreviewFile ?? internalPreviewFile;
  const coverArtFile = externalCoverArtFile ?? internalCoverArtFile;

  const buildAutomaticLicenseFiles = useCallback(
    (newFiles: UploadedFile[]) => {
      const latestByPurpose = new Map<string, string>();

      for (const file of newFiles) {
        if (
          file.purpose === "mp3" ||
          file.purpose === "wav" ||
          file.purpose === "stems"
        ) {
          latestByPurpose.set(file.purpose, file.id);
        }
      }

      const nextLicenseFiles: LicenseFiles = {};

      licenses.forEach((tier) => {
        const requiredFormats = getTierMeta(tier).recommendedFiles;
        nextLicenseFiles[tier.id] = requiredFormats
          .map((format) => latestByPurpose.get(format))
          .filter((value): value is string => Boolean(value));
      });

      return nextLicenseFiles;
    },
    [licenses],
  );

  const updateState = useCallback(
    (
      newFiles: UploadedFile[],
      newPreviewFile: UploadedFile | null,
      newCoverArtFile: UploadedFile | null,
      newLicensePrices: Record<string, string>,
    ) => {
      const newLicenseFiles = buildAutomaticLicenseFiles(newFiles);
      if (onChange) {
        onChange({
          uploadedFiles: newFiles,
          licenseFiles: newLicenseFiles,
          previewFile: newPreviewFile,
          coverArtFile: newCoverArtFile,
          licensePrices: newLicensePrices,
        });
      } else {
        setInternalFiles(newFiles);
        setInternalLicenseFiles(newLicenseFiles);
        setInternalPreviewFile(newPreviewFile);
        setInternalCoverArtFile(newCoverArtFile);
        setInternalLicensePrices(newLicensePrices);
      }
    },
    [buildAutomaticLicenseFiles, onChange],
  );

  const detectFileType = useCallback(
    (filename: string): UploadedFile["type"] => {
      const ext = filename.toLowerCase().split(".").pop();
      if (ext === "mp3") return "mp3";
      if (ext === "wav") return "wav";
      if (ext === "zip") return "stems";
      if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || ""))
        return "cover";
      return "other";
    },
    [],
  );

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Cover art
  const handleCoverArtDrop = useCallback(
    (_: File[], accepted: File[], rejected: File[]) => {
      if (rejected.length > 0) {
        setRejectedFiles([{ file: rejected[0], error: "Use JPG or PNG." }]);
        return;
      }
      const file = accepted[0];
      if (!file) return;
      const newFile: UploadedFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: "cover",
        purpose: "cover",
        size: formatFileSize(file.size),
        file,
      };
      const url = URL.createObjectURL(file);
      setCoverArtPreviewUrl(url);
      updateState(uploadedFiles, previewFile, newFile, licensePrices);
      setRejectedFiles([]);
    },
    [uploadedFiles, previewFile, licensePrices, formatFileSize, updateState],
  );

  const removeCoverArt = useCallback(() => {
    if (coverArtPreviewUrl) URL.revokeObjectURL(coverArtPreviewUrl);
    setCoverArtPreviewUrl(null);
    updateState(uploadedFiles, previewFile, null, licensePrices);
  }, [
    uploadedFiles,
    previewFile,
    licensePrices,
    coverArtPreviewUrl,
    updateState,
  ]);

  // Preview
  const handlePreviewDrop = useCallback(
    async (_: File[], accepted: File[], rejected: File[]) => {
      if (rejected.length > 0) {
        setRejectedFiles([{ file: rejected[0], error: "Use MP3." }]);
        return;
      }
      const file = accepted[0];
      if (!file) return;
      const validation = validateUploadFile(file, ALLOWED_FILE_TYPES);
      if (!validation.valid) {
        setRejectedFiles([{ file, error: validation.error || "Invalid file" }]);
        return;
      }
      const fileData: UploadedFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: "preview",
        purpose: "preview",
        size: formatFileSize(file.size),
        file,
      };
      if (onUpload) {
        try {
          const uploaded = await onUpload([file], "preview");
          updateState(
            uploadedFiles,
            uploaded[0] || null,
            coverArtFile,
            licensePrices,
          );
        } catch (err) {
          setRejectedFiles([
            {
              file,
              error: err instanceof Error ? err.message : "Upload failed",
            },
          ]);
        }
      } else {
        updateState(uploadedFiles, fileData, coverArtFile, licensePrices);
      }
      setRejectedFiles([]);
    },
    [
      uploadedFiles,
      coverArtFile,
      licensePrices,
      onUpload,
      formatFileSize,
      updateState,
    ],
  );

  // License files pool
  const handleLicenseFilesDrop = useCallback(
    async (_: File[], accepted: File[], rejected: File[]) => {
      if (rejected.length > 0) {
        setRejectedFiles(
          rejected.map((f) => ({ file: f, error: "File type not supported" })),
        );
        return;
      }
      const validFiles: UploadedFile[] = [];
      const invalidFiles: Array<{ file: File; error: string }> = [];
      for (const file of accepted) {
        const v = validateUploadFile(file, ALLOWED_FILE_TYPES);
        if (v.valid) {
          const fileType = detectFileType(file.name);
          validFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: fileType,
            purpose:
              fileType === "mp3" || fileType === "wav" || fileType === "stems"
                ? fileType
                : "other",
            size: formatFileSize(file.size),
            file,
          });
        } else {
          invalidFiles.push({ file, error: v.error || "Invalid file" });
        }
      }
      if (invalidFiles.length > 0) {
        setRejectedFiles(invalidFiles);
        return;
      }
      if (onUpload && validFiles.length > 0) {
        try {
          const uploaded = await onUpload(
            validFiles.map((f) => f.file!).filter(Boolean),
            "license",
          );
          const mergedByPurpose = new Map<string, UploadedFile>();
          [...uploadedFiles, ...uploaded].forEach((file) => {
            const purposeKey =
              file.purpose === "mp3" ||
              file.purpose === "wav" ||
              file.purpose === "stems"
                ? file.purpose
                : file.id;
            mergedByPurpose.set(purposeKey, file);
          });
          updateState(
            Array.from(mergedByPurpose.values()),
            previewFile,
            coverArtFile,
            licensePrices,
          );
        } catch (err) {
          setRejectedFiles(
            validFiles
              .map((f) => ({
                file: f.file!,
                error: err instanceof Error ? err.message : "Upload failed",
              }))
              .filter((r) => r.file),
          );
        }
      } else {
        const mergedByPurpose = new Map<string, UploadedFile>();
        [...uploadedFiles, ...validFiles].forEach((file) => {
          const purposeKey =
            file.purpose === "mp3" ||
            file.purpose === "wav" ||
            file.purpose === "stems"
              ? file.purpose
              : file.id;
          mergedByPurpose.set(purposeKey, file);
        });
        updateState(
          Array.from(mergedByPurpose.values()),
          previewFile,
          coverArtFile,
          licensePrices,
        );
      }
      setRejectedFiles([]);
    },
    [
      uploadedFiles,
      previewFile,
      coverArtFile,
      licensePrices,
      onUpload,
      detectFileType,
      formatFileSize,
      updateState,
    ],
  );

  const removePreviewFile = useCallback(
    () => updateState(uploadedFiles, null, coverArtFile, licensePrices),
    [uploadedFiles, coverArtFile, licensePrices, updateState],
  );

  const removeLicenseFile = useCallback(
    (fileId: string) => {
      const updated = uploadedFiles.filter((f) => f.id !== fileId);
      updateState(updated, previewFile, coverArtFile, licensePrices);
    },
    [uploadedFiles, previewFile, coverArtFile, licensePrices, updateState],
  );

  // Handle "Add files" button click → hidden input
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      await handleLicenseFilesDrop(files, files, []);
      // reset so same file can be re-selected
      if (licenseFilesInputRef.current) licenseFilesInputRef.current.value = "";
    },
    [handleLicenseFilesDrop],
  );

  const getFile = useCallback(
    (id: string) => uploadedFiles.find((f) => f.id === id),
    [uploadedFiles],
  );
  const hasSharedStemsFile = uploadedFiles.some(
    (file) => file.purpose === "stems",
  );
  const licensesThatOfferStems = licenses.filter((license) =>
    licenseOffersStems(license.stemsPolicy),
  );
  const stemsUploadRequired = licensesThatOfferStems.length > 0;

  const packageStatusMessage = (
    missingFiles: string[],
    hasAssignments: boolean,
    tier: LicenseTier,
  ) => {
    if (uploadedFiles.length === 0)
      return "Upload delivery files to build this package.";
    if (missingFiles.length > 0) {
      return `Missing: ${missingFiles.map((file) => getFileFormatLabel(file)).join(", ")}`;
    }
    if (stemsAvailableAsAddon(tier.stemsPolicy)) {
      return hasSharedStemsFile
        ? "Base package ready. Shared stems ZIP can fulfill stems add-on orders."
        : "Base package ready. Upload one stems ZIP to fulfill stems add-on orders.";
    }
    if (hasAssignments) return "Matches this license template.";
    return "No matching package files uploaded yet.";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BlockStack gap="400">
      {error && (
        <Banner tone="critical">
          <p>{error}</p>
        </Banner>
      )}

      {rejectedFiles.length > 0 && (
        <Banner
          tone="warning"
          onDismiss={() => setRejectedFiles([])}
          action={{ content: "Clear", onAction: () => setRejectedFiles([]) }}
        >
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Some files could not be added:
            </Text>
            {rejectedFiles.map((r, i) => (
              <Text as="p" key={i} variant="bodySm">
                • {r.file.name}: {r.error}
              </Text>
            ))}
          </BlockStack>
        </Banner>
      )}

      {/* ── Storefront media ── */}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              Storefront media
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Add the artwork and preview audio buyers see before purchase.
            </Text>
          </BlockStack>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "20px",
              alignItems: "start",
            }}
          >
            {/* Left — Cover Art */}
            <BlockStack gap="150">
              <Text variant="bodySm" as="p" tone="subdued">
                Cover Art
              </Text>
              {!coverArtFile ? (
                <div style={{ height: "160px" }}>
                  <DropZone
                    onDrop={handleCoverArtDrop}
                    accept="image/jpeg,image/png,image/webp"
                    type="image"
                    allowMultiple={false}
                    disabled={uploading}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        gap: "8px",
                        padding: "16px",
                      }}
                    >
                      <Icon source={ImageIcon} tone="base" />
                      <Text
                        as="span"
                        variant="bodyXs"
                        tone="subdued"
                        alignment="center"
                      >
                        Add image
                      </Text>
                    </div>
                  </DropZone>
                </div>
              ) : (
                <div
                  style={{
                    position: "relative",
                    height: "160px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid var(--p-color-border)",
                  }}
                >
                  {coverArtPreviewUrl ||
                  coverArtFile?.shopifyResourceUrl ||
                  coverArtFile?.storageUrl ? (
                    <img
                      src={
                        coverArtPreviewUrl ||
                        coverArtFile?.shopifyResourceUrl ||
                        coverArtFile?.storageUrl
                      }
                      alt="Cover art"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "var(--p-color-bg-surface-secondary)",
                      }}
                    >
                      <Icon source={ImageIcon} tone="base" />
                    </div>
                  )}
                  <div
                    style={{ position: "absolute", top: "4px", right: "4px" }}
                  >
                    <Button
                      icon={XIcon}
                      variant="plain"
                      onClick={removeCoverArt}
                      disabled={uploading}
                      accessibilityLabel="Remove cover art"
                    />
                  </div>
                </div>
              )}
            </BlockStack>

            {/* Right — Preview */}
            <BlockStack gap="200">
              <BlockStack gap="200">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h3">
                      Preview audio
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      (required)
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Watermarked MP3 for your storefront player. Never delivered
                    in a license package.
                  </Text>
                </BlockStack>

                {!previewFile ? (
                  <DropZone
                    onDrop={handlePreviewDrop}
                    accept="audio/mpeg"
                    type="file"
                    allowMultiple={false}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Box padding="400">
                        <InlineStack align="center" gap="200">
                          <Spinner size="small" />
                          <Text as="span" variant="bodySm">
                            Uploading…
                          </Text>
                        </InlineStack>
                      </Box>
                    ) : (
                      <DropZone.FileUpload
                        actionTitle="Add preview MP3"
                        actionHint=".mp3 only"
                      />
                    )}
                  </DropZone>
                ) : (
                  <Box
                    borderWidth="025"
                    borderColor="border"
                    borderRadius="200"
                    padding="200"
                  >
                    <InlineStack gap="300" blockAlign="center">
                      <FileFormatBadge format="preview" />
                      <BlockStack gap="0">
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "260px",
                          }}
                        >
                          <Text as="span" variant="bodySm" fontWeight="medium">
                            {previewFile.name}
                          </Text>
                        </div>
                        <Text as="span" variant="bodyXs" tone="subdued">
                          {previewFile.size}
                        </Text>
                      </BlockStack>
                      <div style={{ marginLeft: "auto" }}>
                        <Button
                          icon={XIcon}
                          variant="plain"
                          onClick={removePreviewFile}
                          disabled={uploading}
                          accessibilityLabel="Remove preview"
                        />
                      </div>
                    </InlineStack>
                  </Box>
                )}
              </BlockStack>
            </BlockStack>
          </div>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingMd" as="h2">
                Delivery files
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Upload each master once. Your license templates automatically
                build the right customer package below.
              </Text>
            </BlockStack>
            {uploadedFiles.length > 0 && !uploading && (
              <>
                <Button
                  icon={PlusIcon}
                  onClick={() => licenseFilesInputRef.current?.click()}
                >
                  Add files
                </Button>
                <input
                  ref={licenseFilesInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.wav,.zip"
                  style={{ display: "none" }}
                  onChange={handleFileInputChange}
                />
              </>
            )}
          </InlineStack>

          {stemsUploadRequired && (
            <Banner tone={hasSharedStemsFile ? "success" : "warning"}>
              <p>
                {hasSharedStemsFile
                  ? "Stems ZIP uploaded. Orders that include stems or purchase the stems add-on can be fulfilled."
                  : "At least one license offer includes stems or sells stems as an add-on. Upload one stems ZIP before publishing this beat."}
              </p>
            </Banner>
          )}

          {uploadedFiles.length === 0 ? (
            <DropZone
              onDrop={handleLicenseFilesDrop}
              accept=".mp3,.wav,.zip"
              type="file"
              allowMultiple
              disabled={uploading}
            >
              {uploading ? (
                <Box padding="600">
                  <BlockStack gap="200" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p" variant="bodyMd">
                      Uploading…
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <DropZone.FileUpload actionHint=".mp3, .wav, .zip" />
              )}
            </DropZone>
          ) : (
            <BlockStack gap="150">
              {uploadedFiles.map((file) => (
                <Box
                  key={file.id}
                  borderWidth="025"
                  borderColor="border"
                  borderRadius="200"
                  padding="200"
                >
                  <InlineStack gap="300" blockAlign="center">
                    <FileFormatBadge format={file.purpose || file.type} />
                    <BlockStack gap="0">
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "260px",
                        }}
                      >
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {file.name}
                        </Text>
                      </div>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        {file.size}
                      </Text>
                    </BlockStack>
                    <div style={{ marginLeft: "auto" }}>
                      <Button
                        icon={XIcon}
                        variant="plain"
                        onClick={() => removeLicenseFile(file.id)}
                        disabled={uploading}
                        accessibilityLabel={`Remove ${file.name}`}
                      />
                    </div>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* ── License offers — Shopify Variants Table Layout ── */}
      <Card padding="0">
        <Box
          padding="400"
          paddingBlockEnd="400"
          borderBlockEndWidth="025"
          borderColor="border"
        >
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              License offers
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Set the price for each offer and review what the buyer will
              receive.
            </Text>
          </BlockStack>
        </Box>

        <Box padding="0">
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--p-color-bg-surface-secondary)",
                    borderBottom: "1px solid var(--p-color-border)",
                  }}
                >
                  <th
                    style={{
                      padding: "8px 16px",
                      fontWeight: 500,
                      fontSize: "13px",
                      color: "var(--p-color-text-subdued)",
                      width: "25%",
                    }}
                  >
                    License
                  </th>
                  <th
                    style={{
                      padding: "8px 16px",
                      fontWeight: 500,
                      fontSize: "13px",
                      color: "var(--p-color-text-subdued)",
                      width: "25%",
                    }}
                  >
                    Price
                  </th>
                  <th
                    style={{
                      padding: "8px 16px",
                      fontWeight: 500,
                      fontSize: "13px",
                      color: "var(--p-color-text-subdued)",
                      width: "50%",
                    }}
                  >
                    Delivered package
                  </th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((tier, index) => {
                  const meta = getTierMeta(tier);
                  const isNotLast = index < licenses.length - 1;
                  const tierFiles = licenseFiles[tier.id] || [];
                  const assignedFiles = tierFiles
                    .map((fileId) => getFile(fileId))
                    .filter(Boolean) as UploadedFile[];
                  const missingFiles = meta.recommendedFiles.filter(
                    (format) =>
                      !assignedFiles.some((file) => file.purpose === format),
                  );

                  return (
                    <tr
                      key={tier.id}
                      style={{
                        borderBottom: isNotLast
                          ? "1px solid var(--p-color-border)"
                          : "none",
                      }}
                    >
                      <td
                        style={{ padding: "12px 16px", verticalAlign: "top" }}
                      >
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                          <div>
                            <Box
                              background="bg-surface"
                              borderWidth="025"
                              borderColor="border"
                              borderRadius="200"
                              padding="100"
                            >
                              <Icon source={meta.icon} tone={meta.tint} />
                            </Box>
                          </div>
                          <Text variant="bodyMd" as="span" fontWeight="medium">
                            {tier.name}
                          </Text>
                        </InlineStack>
                      </td>
                      <td
                        style={{ padding: "12px 16px", verticalAlign: "top" }}
                      >
                        <div style={{ maxWidth: "140px" }}>
                          <TextField
                            label="Price"
                            labelHidden
                            autoComplete="off"
                            prefix="$"
                            value={licensePrices[tier.id] || ""}
                            onChange={(val) => {
                              const updated = {
                                ...licensePrices,
                                [tier.id]: val,
                              };
                              updateState(
                                uploadedFiles,
                                previewFile,
                                coverArtFile,
                                updated,
                              );
                            }}
                          />
                        </div>
                      </td>
                      <td
                        style={{ padding: "12px 16px", verticalAlign: "top" }}
                      >
                        <Box
                          padding="200"
                          borderWidth="025"
                          borderColor="border"
                          borderRadius="200"
                          background={
                            uploadedFiles.length === 0
                              ? "bg-surface-disabled"
                              : "bg-surface"
                          }
                        >
                          <BlockStack gap="200">
                            {assignedFiles.length > 0 ? (
                              <InlineStack gap="200" wrap>
                                {assignedFiles.map((file) => (
                                  <FileFormatBadge
                                    key={file.id}
                                    format={file.purpose || file.type}
                                  />
                                ))}
                              </InlineStack>
                            ) : null}

                            <Text
                              as="span"
                              variant="bodySm"
                              tone={
                                uploadedFiles.length === 0
                                  ? "disabled"
                                  : "subdued"
                              }
                            >
                              {packageStatusMessage(
                                missingFiles,
                                assignedFiles.length > 0,
                                tier,
                              )}
                            </Text>

                            {stemsIncludedByDefault(tier.stemsPolicy) && (
                              <Text as="span" variant="bodyXs" tone="subdued">
                                Stems are included in this license, so this
                                package must contain a stems ZIP.
                              </Text>
                            )}

                            {stemsAvailableAsAddon(tier.stemsPolicy) && (
                              <Text as="span" variant="bodyXs" tone="subdued">
                                Buyers can add stems at checkout. The shared
                                stems ZIP is delivered only when purchased.
                              </Text>
                            )}
                          </BlockStack>
                        </Box>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Box>
      </Card>
    </BlockStack>
  );
}

export default LicenseFileAssignment;
