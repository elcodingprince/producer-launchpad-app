import { useState, useCallback, useRef } from "react";
import {
  Badge,
  Card,
  Button,
  Checkbox,
  DropZone,
  InlineStack,
  BlockStack,
  Text,
  Banner,
  Spinner,
  Icon,
  Box,
  Popover,
  Scrollable,
  Tag,
  TextField,
  InlineError,
} from "@shopify/polaris";
import {
  XIcon,
  AlertDiamondIcon,
  StarFilledIcon,
  CheckCircleIcon,
  ImageIcon,
  PlusIcon,
  PlusCircleIcon,
} from "@shopify/polaris-icons";
import { validateUploadFile, ALLOWED_FILE_TYPES } from "../services/bunnyCdn";
import { FileFormatBadge, getFileFormatLabel } from "./FileFormatBadge";
import {
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
  templateStemsPolicy?: string;
  stemsAddonEnabled?: boolean;
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
  storageKey?: string;
  shopifyResourceUrl?: string;
}

export interface LicenseFiles {
  [tierId: string]: string[];
}

export interface StemsAddonSelections {
  [tierId: string]: boolean;
}

export interface LicenseOfferGroup {
  id: string;
  title: string;
  kind: "bundle" | "individual";
  licenseNames: string[];
  warning?: string;
  isEditing?: boolean;
  availableLicenses?: Array<{
    id: string;
    name: string;
    selected: boolean;
  }>;
}

export interface AddableLicenseBundleItem {
  id: string;
  title: string;
  subtitle?: string;
  warning?: string;
  disabled?: boolean;
}

export interface LicenseFileAssignmentProps {
  licenses: LicenseTier[];
  offerGroups?: LicenseOfferGroup[];
  addableBundles?: AddableLicenseBundleItem[];
  onAddBundle?: (bundleId: string) => void;
  onAddIndividual?: () => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onDoneEditingGroup?: (groupId: string) => void;
  onToggleGroupLicense?: (groupId: string, licenseId: string) => void;
  onUseLastUsedOffers?: () => void;
  hasLastUsedOfferSelection?: boolean;
  offerError?: string | null;
  previewError?: string | null;
  priceErrors?: Record<string, string>;
  deliveryErrors?: Record<string, string>;
  onPriceBlur?: (licenseId: string) => void;
  onPreviewInteraction?: () => void;
  onDeliveryInteraction?: () => void;
  uploadedFiles?: UploadedFile[];
  licenseFiles?: LicenseFiles;
  licensePrices?: Record<string, string>;
  stemsAddonSelections?: StemsAddonSelections;
  previewFile?: UploadedFile | null;
  coverArtFile?: UploadedFile | null;
  onChange?: (data: {
    uploadedFiles: UploadedFile[];
    licenseFiles: LicenseFiles;
    previewFile: UploadedFile | null;
    coverArtFile: UploadedFile | null;
    licensePrices: Record<string, string>;
    stemsAddonSelections: StemsAddonSelections;
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

function InlineCriticalError({
  message,
  fieldID,
}: {
  message: string;
  fieldID: string;
}) {
  return <InlineError message={message} fieldID={fieldID} />;
}

function SwitchButton({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          width: "28px",
          height: "16px",
          borderRadius: "999px",
          background: checked
            ? "var(--p-color-bg-fill-brand)"
            : "var(--p-color-bg-fill-tertiary)",
          boxShadow: "inset 0 0 0 1px var(--p-color-border-secondary)",
          transition:
            "background-color 120ms var(--p-motion-ease-out), opacity 120ms var(--p-motion-ease-out)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "14px" : "2px",
            width: "12px",
            height: "12px",
            borderRadius: "999px",
            background: "var(--p-color-bg-surface)",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.16)",
            transition: "left 120ms var(--p-motion-ease-out)",
          }}
        />
      </span>
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function LicenseFileAssignment({
  licenses,
  offerGroups = [],
  addableBundles = [],
  onAddBundle,
  onAddIndividual,
  onEditGroup,
  onDeleteGroup,
  onDoneEditingGroup,
  onToggleGroupLicense,
  onUseLastUsedOffers,
  hasLastUsedOfferSelection = false,
  offerError,
  previewError,
  priceErrors = {},
  deliveryErrors = {},
  onPriceBlur,
  onPreviewInteraction,
  onDeliveryInteraction,
  uploadedFiles: externalFiles,
  licenseFiles: externalLicenseFiles,
  licensePrices: externalLicensePrices,
  stemsAddonSelections: externalStemsAddonSelections,
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
    useState<LicenseFiles>({});
  const [internalLicensePrices, setInternalLicensePrices] = useState<
    Record<string, string>
  >({});
  const [internalStemsAddonSelections, setInternalStemsAddonSelections] =
    useState<StemsAddonSelections>({});
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
  const [isOfferPickerButtonHovered, setIsOfferPickerButtonHovered] =
    useState(false);
  const [addOfferMenuOpen, setAddOfferMenuOpen] = useState(false);
  const [addOfferMenuSearchValue, setAddOfferMenuSearchValue] = useState("");
  const [hoveredAddableBundleId, setHoveredAddableBundleId] = useState<
    string | null
  >(null);
  const [isAddIndividualHovered, setIsAddIndividualHovered] = useState(false);
  const [activeGroupPopoverId, setActiveGroupPopoverId] = useState<
    string | null
  >(null);
  const [activeDeliveryPopoverId, setActiveDeliveryPopoverId] = useState<
    string | null
  >(null);
  const [groupSearchValues, setGroupSearchValues] = useState<
    Record<string, string>
  >({});

  const uploadedFiles = externalFiles ?? internalFiles;
  const licenseFiles = externalLicenseFiles ?? internalLicenseFiles;
  const licensePrices = externalLicensePrices ?? internalLicensePrices;
  const stemsAddonSelections =
    externalStemsAddonSelections ?? internalStemsAddonSelections;
  const previewFile = externalPreviewFile ?? internalPreviewFile;
  const coverArtFile = externalCoverArtFile ?? internalCoverArtFile;
  const hasSelectedOffers = licenses.length > 0;
  const filteredAddableBundles = addableBundles.filter((bundle) => {
    const normalizedQuery = addOfferMenuSearchValue.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return [bundle.title, bundle.subtitle || "", bundle.warning || ""]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

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

      const nextLicenseFiles: LicenseFiles = { ...licenseFiles };

      licenses.forEach((tier) => {
        const requiredFormats = getTierMeta(tier).recommendedFiles;
        nextLicenseFiles[tier.id] = requiredFormats
          .map((format) => latestByPurpose.get(format))
          .filter((value): value is string => Boolean(value));
      });

      return nextLicenseFiles;
    },
    [licenseFiles, licenses],
  );

  const updateState = useCallback(
    (
      newFiles: UploadedFile[],
      newPreviewFile: UploadedFile | null,
      newCoverArtFile: UploadedFile | null,
      newLicensePrices: Record<string, string>,
      newStemsAddonSelections: StemsAddonSelections,
    ) => {
      const newLicenseFiles = buildAutomaticLicenseFiles(newFiles);
      if (onChange) {
        onChange({
          uploadedFiles: newFiles,
          licenseFiles: newLicenseFiles,
          previewFile: newPreviewFile,
          coverArtFile: newCoverArtFile,
          licensePrices: newLicensePrices,
          stemsAddonSelections: newStemsAddonSelections,
        });
      } else {
        setInternalFiles(newFiles);
        setInternalLicenseFiles(newLicenseFiles);
        setInternalPreviewFile(newPreviewFile);
        setInternalCoverArtFile(newCoverArtFile);
        setInternalLicensePrices(newLicensePrices);
        setInternalStemsAddonSelections(newStemsAddonSelections);
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
      updateState(
        uploadedFiles,
        previewFile,
        newFile,
        licensePrices,
        stemsAddonSelections,
      );
      setRejectedFiles([]);
    },
    [
      uploadedFiles,
      previewFile,
      licensePrices,
      stemsAddonSelections,
      formatFileSize,
      updateState,
    ],
  );

  const removeCoverArt = useCallback(() => {
    if (coverArtPreviewUrl) URL.revokeObjectURL(coverArtPreviewUrl);
    setCoverArtPreviewUrl(null);
    updateState(
      uploadedFiles,
      previewFile,
      null,
      licensePrices,
      stemsAddonSelections,
    );
  }, [
    uploadedFiles,
    previewFile,
    licensePrices,
    stemsAddonSelections,
    coverArtPreviewUrl,
    updateState,
  ]);

  // Preview
  const handlePreviewDrop = useCallback(
    async (_: File[], accepted: File[], rejected: File[]) => {
      onPreviewInteraction?.();
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
            stemsAddonSelections,
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
        updateState(
          uploadedFiles,
          fileData,
          coverArtFile,
          licensePrices,
          stemsAddonSelections,
        );
      }
      setRejectedFiles([]);
    },
    [
      uploadedFiles,
      coverArtFile,
      licensePrices,
      stemsAddonSelections,
      onPreviewInteraction,
      onUpload,
      formatFileSize,
      updateState,
    ],
  );

  // License files pool
  const handleLicenseFilesDrop = useCallback(
    async (_: File[], accepted: File[], rejected: File[]) => {
      onDeliveryInteraction?.();
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
            stemsAddonSelections,
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
          stemsAddonSelections,
        );
      }
      setRejectedFiles([]);
    },
    [
      uploadedFiles,
      previewFile,
      coverArtFile,
      licensePrices,
      stemsAddonSelections,
      onDeliveryInteraction,
      onUpload,
      detectFileType,
      formatFileSize,
      updateState,
    ],
  );

  const removePreviewFile = useCallback(
    () => {
      onPreviewInteraction?.();
      updateState(
        uploadedFiles,
        null,
        coverArtFile,
        licensePrices,
        stemsAddonSelections,
      );
    },
    [
      uploadedFiles,
      coverArtFile,
      licensePrices,
      stemsAddonSelections,
      onPreviewInteraction,
      updateState,
    ],
  );

  const removeLicenseFile = useCallback(
    (fileId: string) => {
      const updated = uploadedFiles.filter((f) => f.id !== fileId);
      onDeliveryInteraction?.();
      updateState(
        updated,
        previewFile,
        coverArtFile,
        licensePrices,
        stemsAddonSelections,
      );
    },
    [
      uploadedFiles,
      previewFile,
      coverArtFile,
      licensePrices,
      stemsAddonSelections,
      onDeliveryInteraction,
      updateState,
    ],
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

  const getPackageReadiness = (requiredCount: number, missingCount: number) => {
    if (requiredCount === 0 || missingCount === 0) {
      return {
        label: "Ready",
        tone: "success" as const,
      };
    }

    return {
      label: "Needs files",
      tone: "critical" as const,
    };
  };

  const getPackageSummary = (requiredCount: number, missingCount: number) => {
    if (requiredCount === 0) return "No required files for this license.";

    const readyCount = Math.max(requiredCount - missingCount, 0);
    const noun = requiredCount === 1 ? "file" : "files";

    if (missingCount === 0) {
      return `${requiredCount} required ${noun} ready`;
    }

    return `${readyCount} of ${requiredCount} required ${noun} ready`;
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
              <Text variant="bodyXs" as="p" tone="subdued">
                Upload at least 1024 x 1024 px for best quality. Ideal size is
                1400 x 1400 px for sharper retina and zoomed-in views. Square is
                best, but near-square art like 4:5 or 5:4 is okay.
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
                        objectFit: "contain",
                        objectPosition: "center",
                        display: "block",
                        padding: "12px",
                        background:
                          "radial-gradient(circle at center, rgba(0, 0, 0, 0.04), transparent 72%), var(--p-color-bg-surface-secondary)",
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
                  <Text variant="headingSm" as="h3">
                    Preview audio
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Watermarked MP3 for your storefront player. Not included
                    in license packages.
                  </Text>
                </BlockStack>

                {!previewFile ? (
                  <div
                    style={{
                      borderRadius: "12px",
                      boxShadow: previewError
                        ? "0 0 0 1px var(--p-color-border-critical)"
                        : undefined,
                    }}
                  >
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
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: "8px",
                      border: previewError
                        ? "1px solid var(--p-color-border-critical)"
                        : undefined,
                      background: previewError
                        ? "var(--p-color-bg-surface-critical)"
                        : undefined,
                    }}
                  >
                    <Box
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="200"
                      padding="200"
                      background="bg-surface"
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
                  </div>
                )}

                {previewError ? (
                  <InlineCriticalError
                    message={previewError}
                    fieldID="preview-audio"
                  />
                ) : null}
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
                Upload your master files. Each license tier packages the right
                formats automatically.
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
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text variant="headingMd" as="h2">
                License offers
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Add bundles or individual licenses, then set the price for each
                offer and review what the buyer will receive.
              </Text>
            </BlockStack>

            <div
              style={{
                borderRadius: "8px",
                border: offerError
                  ? "1px solid var(--p-color-border-critical)"
                  : undefined,
                background: offerError
                  ? "var(--p-color-bg-surface-critical)"
                  : undefined,
              }}
            >
              <Box borderWidth="025" borderColor="border" borderRadius="200">
                <BlockStack gap="0">
                  {offerGroups.map((group, index) => (
                    <Box
                      key={group.id}
                      padding="300"
                      borderBlockEndWidth={
                        index < offerGroups.length - 1 ||
                        onAddBundle ||
                        onAddIndividual
                          ? "025"
                          : "0"
                      }
                      borderColor="border"
                    >
                      {group.isEditing && group.kind === "bundle" ? (
                        <BlockStack gap="300">
                          <BlockStack gap="150">
                            <Text as="p" variant="bodyMd" fontWeight="medium">
                              {group.title}
                            </Text>

                            {group.warning ? (
                              <Text as="p" variant="bodySm" tone="critical">
                                {group.warning}
                              </Text>
                            ) : null}
                          </BlockStack>

                          <Popover
                            active={activeGroupPopoverId === group.id}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            onClose={() => setActiveGroupPopoverId(null)}
                            activator={
                              <Box
                                borderWidth="025"
                                borderColor="border"
                                borderRadius="200"
                                padding="200"
                              >
                                <BlockStack gap="200">
                                  {group.licenseNames.length > 0 ? (
                                    <InlineStack gap="150" wrap>
                                      {group.licenseNames.map((licenseName) => {
                                        const matchedLicense = (
                                          group.availableLicenses || []
                                        ).find(
                                          (license) =>
                                            license.name === licenseName &&
                                            license.selected,
                                        );

                                        return (
                                          <Tag
                                            key={`${group.id}-${licenseName}`}
                                            onRemove={() => {
                                              if (matchedLicense) {
                                                onToggleGroupLicense?.(
                                                  group.id,
                                                  matchedLicense.id,
                                                );
                                              }
                                            }}
                                          >
                                            {licenseName}
                                          </Tag>
                                        );
                                      })}
                                    </InlineStack>
                                  ) : (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      No active licenses are selected in this
                                      bundle.
                                    </Text>
                                  )}

                                  <input
                                    value={groupSearchValues[group.id] || ""}
                                    onFocus={() => setActiveGroupPopoverId(group.id)}
                                    onChange={(event) => {
                                      setGroupSearchValues((current) => ({
                                        ...current,
                                        [group.id]: event.currentTarget.value,
                                      }));
                                      setActiveGroupPopoverId(group.id);
                                    }}
                                    placeholder="Search licenses"
                                    style={{
                                      border: "none",
                                      outline: "none",
                                      padding: 0,
                                      background: "transparent",
                                      fontSize: "16px",
                                      lineHeight: "24px",
                                      width: "100%",
                                      color: "var(--p-color-text)",
                                    }}
                                  />
                                </BlockStack>
                              </Box>
                            }
                          >
                            <Box minWidth="320px">
                              <Scrollable shadow style={{ maxHeight: "240px" }}>
                                <BlockStack gap="0">
                                  {(group.availableLicenses || [])
                                    .filter((license) => {
                                      const normalizedQuery = (
                                        groupSearchValues[group.id] || ""
                                      )
                                        .trim()
                                        .toLowerCase();
                                      if (!normalizedQuery) return true;
                                      return license.name
                                        .toLowerCase()
                                        .includes(normalizedQuery);
                                    })
                                    .map((license) => (
                                      <Box
                                        key={`${group.id}-${license.id}`}
                                        paddingInline="200"
                                        paddingBlock="050"
                                        background={
                                          license.selected
                                            ? "bg-surface-secondary"
                                            : "bg-surface"
                                        }
                                      >
                                        <Checkbox
                                          label={license.name}
                                          checked={license.selected}
                                          onChange={() =>
                                            onToggleGroupLicense?.(
                                              group.id,
                                              license.id,
                                            )
                                          }
                                        />
                                      </Box>
                                    ))}
                                </BlockStack>
                              </Scrollable>
                            </Box>
                          </Popover>

                          <InlineStack align="space-between" blockAlign="center">
                            <Button
                              tone="critical"
                              variant="secondary"
                              onClick={() => onDeleteGroup?.(group.id)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => onDoneEditingGroup?.(group.id)}
                            >
                              Done
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditGroup?.(group.id)}
                          style={{
                            appearance: "none",
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            margin: 0,
                            width: "100%",
                            textAlign: "left",
                            cursor: onEditGroup ? "pointer" : "default",
                          }}
                        >
                          <BlockStack gap="150">
                            <Text as="p" variant="bodyMd" fontWeight="medium">
                              {group.title}
                            </Text>

                            {group.licenseNames.length > 0 ? (
                              <InlineStack gap="150" wrap>
                                {group.licenseNames.map((licenseName) => (
                                  <Badge key={`${group.id}-${licenseName}`}>
                                    {licenseName}
                                  </Badge>
                                ))}
                              </InlineStack>
                            ) : (
                              <Text as="p" variant="bodySm" tone="subdued">
                                No active licenses are included right now.
                              </Text>
                            )}

                            {group.warning ? (
                              <Text as="p" variant="bodySm" tone="critical">
                                {group.warning}
                              </Text>
                            ) : null}
                          </BlockStack>
                        </button>
                      )}
                    </Box>
                  ))}

                  {onAddBundle || onAddIndividual ? (
                    <Box padding="0">
                      <Popover
                        active={addOfferMenuOpen}
                        autofocusTarget="first-node"
                        preferredAlignment="left"
                        onClose={() => setAddOfferMenuOpen(false)}
                        activator={
                          <button
                            type="button"
                            onClick={() => setAddOfferMenuOpen((open) => !open)}
                            onMouseEnter={() =>
                              setIsOfferPickerButtonHovered(true)
                            }
                            onMouseLeave={() =>
                              setIsOfferPickerButtonHovered(false)
                            }
                            style={{
                              appearance: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              border: "none",
                              background: isOfferPickerButtonHovered
                                ? "var(--p-color-bg-surface-secondary)"
                                : "transparent",
                              cursor: "pointer",
                              padding: hasSelectedOffers ? "12px 16px" : "4px 0",
                              textAlign: "left",
                              borderRadius: "10px",
                              width: hasSelectedOffers ? "100%" : "auto",
                              transition:
                                "background-color 120ms var(--p-motion-ease-out)",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Icon source={PlusCircleIcon} />
                            </span>
                            {hasSelectedOffers ? (
                              <Text as="span" variant="bodyMd">
                                Add another license
                              </Text>
                            ) : (
                              <Text as="span" variant="bodySm">
                                Choose bundles first, then fine-tune with
                                individual licenses.
                              </Text>
                            )}
                          </button>
                        }
                      >
                        <Box minWidth="320px" maxWidth="360px">
                          <Box
                            padding="200"
                            borderBlockEndWidth="025"
                            borderColor="border"
                          >
                            <BlockStack gap="200">
                              <TextField
                                label="Search bundles"
                                labelHidden
                                autoComplete="off"
                                placeholder="Search"
                                value={addOfferMenuSearchValue}
                                onChange={setAddOfferMenuSearchValue}
                              />
                              <BlockStack gap="100">
                                <Text as="p" variant="bodyMd" fontWeight="medium">
                                  Recommended
                                </Text>
                                <Scrollable shadow style={{ maxHeight: "220px" }}>
                                  <BlockStack gap="050">
                                    {filteredAddableBundles.length > 0 ? (
                                      filteredAddableBundles.map((bundle) => (
                                        <button
                                          key={bundle.id}
                                          type="button"
                                          disabled={bundle.disabled}
                                          onMouseEnter={() =>
                                            setHoveredAddableBundleId(bundle.id)
                                          }
                                          onMouseLeave={() =>
                                            setHoveredAddableBundleId((current) =>
                                              current === bundle.id ? null : current,
                                            )
                                          }
                                          onClick={() => {
                                            onAddBundle?.(bundle.id);
                                            setAddOfferMenuOpen(false);
                                            setAddOfferMenuSearchValue("");
                                          }}
                                          style={{
                                            appearance: "none",
                                            border: "none",
                                            background:
                                              hoveredAddableBundleId === bundle.id
                                                ? "var(--p-color-bg-surface-secondary)"
                                                : "transparent",
                                            cursor: bundle.disabled
                                              ? "not-allowed"
                                              : "pointer",
                                            textAlign: "left",
                                            width: "100%",
                                            padding: "6px 8px",
                                            borderRadius: "10px",
                                            opacity: bundle.disabled ? 0.55 : 1,
                                            transition:
                                              "background-color 120ms var(--p-motion-ease-out)",
                                          }}
                                        >
                                          <Text as="span" variant="bodyMd">
                                            {bundle.title}
                                          </Text>
                                        </button>
                                      ))
                                    ) : (
                                      <Text as="p" variant="bodySm" tone="subdued">
                                        No bundles match this search.
                                      </Text>
                                    )}
                                  </BlockStack>
                                </Scrollable>
                              </BlockStack>
                            </BlockStack>
                          </Box>

                          <Box padding="150">
                            <button
                              type="button"
                              onMouseEnter={() => setIsAddIndividualHovered(true)}
                              onMouseLeave={() => setIsAddIndividualHovered(false)}
                              onClick={() => {
                                onAddIndividual?.();
                                setAddOfferMenuOpen(false);
                                setAddOfferMenuSearchValue("");
                              }}
                              style={{
                                appearance: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                border: "none",
                                background: isAddIndividualHovered
                                  ? "var(--p-color-bg-surface-secondary)"
                                  : "transparent",
                                cursor: "pointer",
                                padding: "6px 10px",
                                borderRadius: "10px",
                                transition:
                                  "background-color 120ms var(--p-motion-ease-out)",
                              }}
                            >
                              <Icon source={PlusCircleIcon} />
                              <Text as="span" variant="bodySm">
                                Add individual
                              </Text>
                            </button>
                          </Box>
                        </Box>
                      </Popover>
                    </Box>
                  ) : null}
                </BlockStack>
              </Box>
            </div>

            {offerError ? (
              <InlineCriticalError
                message={offerError}
                fieldID="license-offers"
              />
            ) : null}

            {!hasSelectedOffers &&
            hasLastUsedOfferSelection &&
            onUseLastUsedOffers ? (
              <InlineStack gap="200" blockAlign="center">
                <Button variant="plain" onClick={onUseLastUsedOffers}>
                  Use last used offers
                </Button>
                <Text as="span" variant="bodySm" tone="subdued">
                  Start from the most recent draft or upload setup.
                </Text>
              </InlineStack>
            ) : null}
          </BlockStack>
        </Box>

        <Box padding="0">
          {hasSelectedOffers ? (
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
                        width: "22%",
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
                        width: "26%",
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
                        width: "30%",
                      }}
                    >
                      Delivered package
                    </th>
                    <th
                      style={{
                        padding: "8px 16px",
                        fontWeight: 500,
                        fontSize: "13px",
                        color: "var(--p-color-text-subdued)",
                        width: "22%",
                      }}
                    >
                      Stems add-on
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
                    const supportsStemsAddon = stemsAvailableAsAddon(
                      tier.templateStemsPolicy || tier.stemsPolicy,
                    );
                    const stemsIncluded = stemsIncludedByDefault(tier.stemsPolicy);
                    const addonSelected = Boolean(stemsAddonSelections[tier.id]);
                    const reviewExpectedFormats = [...meta.recommendedFiles];

                    if (
                      supportsStemsAddon &&
                      addonSelected &&
                      !reviewExpectedFormats.includes("stems")
                    ) {
                      reviewExpectedFormats.push("stems");
                    }

                    const readyReviewFormats = reviewExpectedFormats.filter(
                      (format) =>
                        format === "stems"
                          ? hasSharedStemsFile
                          : assignedFiles.some((file) => file.purpose === format),
                    );
                    const missingFiles = reviewExpectedFormats.filter(
                      (format) =>
                        format === "stems"
                          ? !hasSharedStemsFile
                          : !assignedFiles.some((file) => file.purpose === format),
                    );
                    const packageReadiness = getPackageReadiness(
                      reviewExpectedFormats.length,
                      missingFiles.length,
                    );
                    const packageSummary = getPackageSummary(
                      reviewExpectedFormats.length,
                      missingFiles.length,
                    );
                    const missingFilesMessage =
                      missingFiles.length > 0
                        ? `Missing ${missingFiles
                            .map((format) => getFileFormatLabel(format))
                            .join(", ")}`
                        : null;

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
                          <div style={{ maxWidth: "184px", minWidth: "168px" }}>
                            <TextField
                              label="Price"
                              labelHidden
                              autoComplete="off"
                              prefix="$"
                              value={licensePrices[tier.id] || ""}
                              error={priceErrors[tier.id]}
                              onBlur={() => onPriceBlur?.(tier.id)}
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
                                  stemsAddonSelections,
                                );
                              }}
                            />
                          </div>
                        </td>
                        <td
                          style={{ padding: "12px 16px", verticalAlign: "top" }}
                        >
                          <BlockStack gap="250">
                            <Popover
                              active={activeDeliveryPopoverId === tier.id}
                              preferredAlignment="right"
                              onClose={() => setActiveDeliveryPopoverId(null)}
                              activator={
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDeliveryPopoverId((current) =>
                                      current === tier.id ? null : tier.id,
                                    )
                                  }
                                  style={{
                                    appearance: "none",
                                    border: "none",
                                    background: "transparent",
                                    padding: 0,
                                    margin: 0,
                                    cursor: "pointer",
                                  }}
                                  aria-label={`Review files for ${tier.name}`}
                                >
                                  <Badge tone={packageReadiness.tone}>
                                    {packageReadiness.label}
                                  </Badge>
                                </button>
                              }
                            >
                              <Box padding="300" minWidth="280px">
                                <BlockStack gap="250">
                                  <BlockStack gap="150">
                                    <Text
                                      as="p"
                                      variant="bodySm"
                                      fontWeight="medium"
                                    >
                                      Included files
                                    </Text>
                                    {readyReviewFormats.length > 0 ? (
                                      <InlineStack gap="150" wrap>
                                        {readyReviewFormats.map((format) => (
                                          <FileFormatBadge
                                            key={`${tier.id}-assigned-${format}`}
                                            format={format}
                                          />
                                        ))}
                                      </InlineStack>
                                    ) : (
                                      <Text
                                        as="p"
                                        variant="bodySm"
                                        tone="subdued"
                                      >
                                        No required files added yet.
                                      </Text>
                                    )}
                                  </BlockStack>

                                  <BlockStack gap="150">
                                    <Text
                                      as="p"
                                      variant="bodySm"
                                      fontWeight="medium"
                                    >
                                      Base package
                                    </Text>
                                    <InlineStack gap="150" wrap>
                                      {meta.recommendedFiles.map((format) => (
                                        <FileFormatBadge
                                          key={`${tier.id}-expected-${format}`}
                                          format={format}
                                        />
                                      ))}
                                    </InlineStack>
                                  </BlockStack>

                                  {supportsStemsAddon && addonSelected ? (
                                    <BlockStack gap="150">
                                      <Text
                                        as="p"
                                        variant="bodySm"
                                        fontWeight="medium"
                                      >
                                        Stems add-on
                                      </Text>
                                      <InlineStack gap="150" wrap>
                                        <Badge>
                                          STEMS ZIP
                                        </Badge>
                                      </InlineStack>
                                    </BlockStack>
                                  ) : null}

                                  {missingFilesMessage ? (
                                    <InlineCriticalError
                                      message={missingFilesMessage}
                                      fieldID={`delivery-package-popover-${tier.id}`}
                                    />
                                  ) : null}
                                </BlockStack>
                              </Box>
                            </Popover>

                            <Text
                              as="span"
                              variant="bodySm"
                              tone={
                                uploadedFiles.length === 0
                                  ? "disabled"
                                  : "subdued"
                              }
                            >
                              {packageSummary}
                            </Text>
                          </BlockStack>
                        </td>
                        <td
                          style={{ padding: "12px 16px", verticalAlign: "top" }}
                        >
                          <InlineStack gap="150" blockAlign="center">
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                minHeight: "16px",
                              }}
                            >
                              <Text as="span" variant="bodySm" tone="subdued">
                                Include
                              </Text>
                            </span>
                            <SwitchButton
                              checked={stemsIncluded ? true : addonSelected}
                              disabled={stemsIncluded || !supportsStemsAddon}
                              label={`Include stems for ${tier.name}`}
                              onChange={(checked) => {
                                const nextSelections = {
                                  ...stemsAddonSelections,
                                  [tier.id]: checked,
                                };
                                updateState(
                                  uploadedFiles,
                                  previewFile,
                                  coverArtFile,
                                  licensePrices,
                                  nextSelections,
                                );
                              }}
                            />
                          </InlineStack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Box>
      </Card>
    </BlockStack>
  );
}

export default LicenseFileAssignment;
