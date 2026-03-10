import { useState, useCallback, memo } from 'react';
import {
  Card,
  Button,
  DropZone,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  ActionList,
  Popover,
  Banner,
  Spinner,
} from '@shopify/polaris';
import {
  PlusIcon,
  XIcon,
  SoundIcon,
} from '@shopify/polaris-icons';
import { validateUploadFile, ALLOWED_FILE_TYPES } from '../services/bunnyCdn';

// File type badge component - defined outside main component for performance
const FileTypeBadge = memo(({ type, purpose }: { type: string; purpose?: string }) => {
  const FILE_TYPES: Record<string, { label: string; icon: string; color: string }> = {
    mp3: { label: 'MP3', icon: '🎵', color: '#10B981' },
    wav: { label: 'WAV', icon: '🎼', color: '#3B82F6' },
    stems: { label: 'Stems', icon: '📦', color: '#F59E0B' },
    cover: { label: 'Cover Art', icon: '🖼️', color: '#EC4899' },
    preview: { label: 'Preview', icon: '▶️', color: '#8B5CF6' },
    other: { label: 'File', icon: '📄', color: '#6B7280' },
  };

  const config = FILE_TYPES[purpose || type] || FILE_TYPES.other;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
});

FileTypeBadge.displayName = 'FileTypeBadge';

// License tier type
export interface LicenseTier {
  id: string;
  name: string;
  price: string;
  description?: string;
  color?: string;
  icon?: string;
  recommendedFiles?: string[];
}

// Uploaded file type
export interface UploadedFile {
  id: string;
  name: string;
  type: 'mp3' | 'wav' | 'stems' | 'cover' | 'preview' | 'other';
  purpose: 'preview' | 'mp3' | 'wav' | 'stems' | 'cover' | 'license_pdf' | 'other';
  size: string;
  file?: File;
  storageUrl?: string;
}

// License file mapping
export interface LicenseFiles {
  [tierId: string]: string[];
}

// Component props
export interface LicenseFileAssignmentProps {
  licenses: LicenseTier[];
  uploadedFiles?: UploadedFile[];
  licenseFiles?: LicenseFiles;
  previewFile?: UploadedFile | null;
  onChange?: (data: {
    uploadedFiles: UploadedFile[];
    licenseFiles: LicenseFiles;
    previewFile: UploadedFile | null;
  }) => void;
  onUpload?: (files: File[], purpose: 'preview' | 'license') => Promise<UploadedFile[]>;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

// Default license tier styling
const DEFAULT_TIER_STYLES: Record<string, { color: string; icon: string; recommendedFiles: string[] }> = {
  basic: { color: '#0066FF', icon: '🔷', recommendedFiles: ['mp3'] },
  premium: { color: '#8B5CF6', icon: '💎', recommendedFiles: ['mp3', 'wav'] },
  unlimited: { color: '#F59E0B', icon: '👑', recommendedFiles: ['mp3', 'wav', 'stems'] },
};

// Helper function
const getTierStyle = (tier: LicenseTier) => {
  const defaultStyle = DEFAULT_TIER_STYLES[tier.id] || {
    color: '#6B7280',
    icon: '📋',
    recommendedFiles: [],
  };
  return {
    color: tier.color || defaultStyle.color,
    icon: tier.icon || defaultStyle.icon,
    recommendedFiles: tier.recommendedFiles || defaultStyle.recommendedFiles,
  };
};

export function LicenseFileAssignment({
  licenses,
  uploadedFiles: externalFiles,
  licenseFiles: externalLicenseFiles,
  previewFile: externalPreviewFile,
  onChange,
  onUpload,
  uploading = false,
  uploadProgress,
  error,
}: LicenseFileAssignmentProps) {
  // Internal state
  const [internalFiles, setInternalFiles] = useState<UploadedFile[]>([]);
  const [internalLicenseFiles, setInternalLicenseFiles] = useState<LicenseFiles>({
    basic: [],
    premium: [],
    unlimited: [],
  });
  const [internalPreviewFile, setInternalPreviewFile] = useState<UploadedFile | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ file: File; error: string }>>([]);

  // Use external state if provided
  const uploadedFiles = externalFiles ?? internalFiles;
  const licenseFiles = externalLicenseFiles ?? internalLicenseFiles;
  const previewFile = externalPreviewFile ?? internalPreviewFile;

  // Update state helper
  const updateState = useCallback(
    (newFiles: UploadedFile[], newLicenseFiles: LicenseFiles, newPreviewFile: UploadedFile | null) => {
      if (onChange) {
        onChange({ uploadedFiles: newFiles, licenseFiles: newLicenseFiles, previewFile: newPreviewFile });
      } else {
        setInternalFiles(newFiles);
        setInternalLicenseFiles(newLicenseFiles);
        setInternalPreviewFile(newPreviewFile);
      }
    },
    [onChange]
  );

  // Detect file type
  const detectFileType = useCallback((filename: string): UploadedFile['type'] => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'mp3') return 'mp3';
    if (ext === 'wav') return 'wav';
    if (ext === 'zip') return 'stems';
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) return 'cover';
    return 'other';
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Handle preview file drop
  const handlePreviewDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[], rejectedFilesInput: File[]) => {
      if (rejectedFilesInput.length > 0) {
        setRejectedFiles([{ file: rejectedFilesInput[0], error: 'File type not supported. Use MP3.' }]);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      const validation = validateUploadFile(file, ALLOWED_FILE_TYPES);
      if (!validation.valid) {
        setRejectedFiles([{ file, error: validation.error || 'Invalid file' }]);
        return;
      }

      const previewFileData: UploadedFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: 'preview',
        purpose: 'preview',
        size: formatFileSize(file.size),
        file,
      };

      if (onUpload) {
        try {
          const uploaded = await onUpload([file], 'preview');
          updateState(uploadedFiles, licenseFiles, uploaded[0] || null);
        } catch (err) {
          setRejectedFiles([{ file, error: err instanceof Error ? err.message : 'Upload failed' }]);
        }
      } else {
        updateState(uploadedFiles, licenseFiles, previewFileData);
      }

      setRejectedFiles([]);
    },
    [uploadedFiles, licenseFiles, onUpload, formatFileSize, updateState]
  );

  // Handle license files drop
  const handleLicenseFilesDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[], rejectedFilesInput: File[]) => {
      if (rejectedFilesInput.length > 0) {
        setRejectedFiles(rejectedFilesInput.map((f) => ({ file: f, error: 'File type not supported' })));
        return;
      }

      const validFiles: UploadedFile[] = [];
      const invalidFiles: Array<{ file: File; error: string }> = [];

      for (const file of acceptedFiles) {
        const validation = validateUploadFile(file, ALLOWED_FILE_TYPES);
        if (validation.valid) {
          const fileType = detectFileType(file.name);
          validFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: fileType,
            purpose: fileType === 'mp3' || fileType === 'wav' || fileType === 'stems' ? fileType : 'other',
            size: formatFileSize(file.size),
            file,
          });
        } else {
          invalidFiles.push({ file, error: validation.error || 'Invalid file' });
        }
      }

      if (invalidFiles.length > 0) {
        setRejectedFiles(invalidFiles);
        return;
      }

      if (onUpload && validFiles.length > 0) {
        try {
          const filesToUpload = validFiles.map((f) => f.file).filter((f): f is File => f !== undefined);
          const uploaded = await onUpload(filesToUpload, 'license');
          updateState([...uploadedFiles, ...uploaded], licenseFiles, previewFile);
        } catch (err) {
          setRejectedFiles(
            validFiles
              .map((f) => ({ file: f.file, error: err instanceof Error ? err.message : 'Upload failed' }))
              .filter((r): r is { file: File; error: string } => r.file !== undefined)
          );
        }
      } else {
        updateState([...uploadedFiles, ...validFiles], licenseFiles, previewFile);
      }

      setRejectedFiles([]);
    },
    [uploadedFiles, licenseFiles, previewFile, onUpload, detectFileType, formatFileSize, updateState]
  );

  // Remove preview file
  const removePreviewFile = useCallback(() => {
    updateState(uploadedFiles, licenseFiles, null);
  }, [uploadedFiles, licenseFiles, updateState]);

  // Add file to license tier
  const addFileToLicense = useCallback(
    (fileId: string, tierId: string) => {
      const updatedLicenseFiles = {
        ...licenseFiles,
        [tierId]: [...(licenseFiles[tierId] || []), fileId],
      };
      updateState(uploadedFiles, updatedLicenseFiles, previewFile);
      setActivePopover(null);
    },
    [uploadedFiles, licenseFiles, previewFile, updateState]
  );

  // Remove file from license tier
  const removeFileFromLicense = useCallback(
    (fileId: string, tierId: string) => {
      const updatedLicenseFiles = {
        ...licenseFiles,
        [tierId]: (licenseFiles[tierId] || []).filter((id) => id !== fileId),
      };
      updateState(uploadedFiles, updatedLicenseFiles, previewFile);
    },
    [uploadedFiles, licenseFiles, previewFile, updateState]
  );

  // Remove license file entirely
  const removeLicenseFile = useCallback(
    (fileId: string) => {
      const updatedFiles = uploadedFiles.filter((f) => f.id !== fileId);
      const updatedLicenseFiles: LicenseFiles = {};
      Object.keys(licenseFiles).forEach((tierId) => {
        updatedLicenseFiles[tierId] = licenseFiles[tierId].filter((id) => id !== fileId);
      });
      updateState(updatedFiles, updatedLicenseFiles, previewFile);
    },
    [uploadedFiles, licenseFiles, previewFile, updateState]
  );

  // Get file by ID
  const getFile = useCallback(
    (fileId: string) => {
      return uploadedFiles.find((f) => f.id === fileId);
    },
    [uploadedFiles]
  );

  // Get unassigned files for a tier
  const getUnassignedFiles = useCallback(
    (tierId: string) => {
      const assignedToTier = licenseFiles[tierId] || [];
      return uploadedFiles.filter((f) => !assignedToTier.includes(f.id));
    },
    [uploadedFiles, licenseFiles]
  );

  // Check if all tiers have files
  const isComplete = useCallback(() => {
    return licenses.every((license) => (licenseFiles[license.id]?.length || 0) > 0);
  }, [licenses, licenseFiles]);

  return (
    <BlockStack gap="600">
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <Text variant="headingXl" as="h1">
          Upload Beat Files
        </Text>
        <Text variant="bodyMd" tone="subdued">
          Upload preview and license files for your beat
        </Text>
      </div>

      {/* Error Banner */}
      {error && (
        <Banner tone="critical">
          <p>{error}</p>
        </Banner>
      )}

      {/* Rejected Files Banner */}
      {rejectedFiles.length > 0 && (
        <Banner
          tone="warning"
          onDismiss={() => setRejectedFiles([])}
          action={{ content: 'Clear', onAction: () => setRejectedFiles([]) }}
        >
          <BlockStack gap="200">
            <Text variant="bodyMd" fontWeight="semibold">
              Some files could not be added:
            </Text>
            {rejectedFiles.map((rejected, index) => (
              <Text key={index} variant="bodySm">
                • {rejected.file.name}: {rejected.error}
              </Text>
            ))}
          </BlockStack>
        </Banner>
      )}

      {/* Step 0: Preview Audio */}
      <Card>
        <BlockStack gap="400">
          <div>
            <Text variant="headingMd" as="h2">
              Step 1: Preview Audio (Required)
            </Text>
            <Text variant="bodySm" tone="subdued">
              This watermarked MP3 plays on your storefront. It's not part of any license package.
            </Text>
          </div>

          {!previewFile ? (
            <DropZone
              onDrop={handlePreviewDrop}
              accept="audio/mpeg"
              type="file"
              allowMultiple={false}
              disabled={uploading}
            >
              {uploading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '32px',
                  }}
                >
                  <Spinner size="large" />
                  <Text variant="bodyMd">Uploading preview...</Text>
                </div>
              ) : (
                <DropZone.FileUpload actionHint="Accepts .mp3 for storefront preview" />
              )}
            </DropZone>
          ) : (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#F3E8FF',
                borderRadius: '8px',
                border: '1px solid #D8B4FE',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <FileTypeBadge type="preview" purpose="preview" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" fontWeight="medium">
                  {previewFile.name}
                </Text>
                <Text variant="bodyXs" tone="subdued">
                  {previewFile.size}
                </Text>
              </div>
              <Button
                icon={XIcon}
                tone="critical"
                variant="plain"
                onClick={removePreviewFile}
                disabled={uploading}
                accessibilityLabel="Remove preview file"
              />
            </div>
          )}
        </BlockStack>
      </Card>

      {/* Step 1: License Files */}
      <Card>
        <BlockStack gap="400">
          <div>
            <Text variant="headingMd" as="h2">
              Step 2: License Files
            </Text>
            <Text variant="bodySm" tone="subdued">
              Upload files that will be included in license packages (MP3, WAV, stems)
            </Text>
          </div>

          <DropZone
            onDrop={handleLicenseFilesDrop}
            accept=".mp3,.wav,.zip"
            type="file"
            allowMultiple
            disabled={uploading}
          >
            {uploading ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '32px',
                }}
              >
                <Spinner size="large" />
                <Text variant="bodyMd">Uploading...</Text>
                {uploadProgress !== undefined && (
                  <Text variant="bodySm" tone="subdued">{uploadProgress}%</Text>
                )}
              </div>
            ) : (
              <DropZone.FileUpload actionHint="Accepts .mp3, .wav, .zip" />
            )}
          </DropZone>

          {/* Uploaded License Files List */}
          {uploadedFiles.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
                marginTop: '16px',
              }}
            >
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <FileTypeBadge type={file.type} purpose={file.purpose} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      variant="bodySm"
                      fontWeight="medium"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {file.name}
                    </Text>
                    <Text variant="bodyXs" tone="subdued">
                      {file.size}
                    </Text>
                  </div>
                  <Button
                    icon={XIcon}
                    tone="critical"
                    variant="plain"
                    onClick={() => removeLicenseFile(file.id)}
                    disabled={uploading}
                    accessibilityLabel={`Remove ${file.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </BlockStack>
      </Card>

      {/* Step 2: Assign to License Tiers */}
      {uploadedFiles.length > 0 && (
        <>
          <Text variant="headingMd" as="h2">
            Step 3: Assign to License Tiers
          </Text>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {licenses.map((tier) => {
              const style = getTierStyle(tier);
              const tierFiles = licenseFiles[tier.id] || [];
              const unassignedFiles = getUnassignedFiles(tier.id);

              return (
                <Card key={tier.id}>
                  <BlockStack gap="400">
                    {/* Tier Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        paddingBottom: '12px',
                        borderBottom: `2px solid ${style.color}`,
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{style.icon}</span>
                      <div style={{ flex: 1 }}>
                        <InlineStack align="space-between">
                          <Text variant="headingMd" as="h3">
                            {tier.name}
                          </Text>
                          <Text variant="headingMd" as="span" tone="success" fontWeight="bold">
                            {tier.price}
                          </Text>
                        </InlineStack>
                        {tier.description && (
                          <Text variant="bodySm" tone="subdued">
                            {tier.description}
                          </Text>
                        )}
                      </div>
                    </div>

                    {/* Files in this tier */}
                    <div style={{ minHeight: '100px' }}>
                      {tierFiles.length === 0 ? (
                        <div
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            backgroundColor: '#F9FAFB',
                            borderRadius: '8px',
                            border: '2px dashed #E5E7EB',
                          }}
                        >
                          <Text variant="bodySm" tone="subdued">
                            No files assigned yet
                          </Text>
                        </div>
                      ) : (
                        <BlockStack gap="200">
                          {tierFiles.map((fileId) => {
                            const file = getFile(fileId);
                            if (!file) return null;
                            return (
                              <div
                                key={fileId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: '#F0FDF4',
                                  borderRadius: '6px',
                                  border: '1px solid #BBF7D0',
                                }}
                              >
                                <FileTypeBadge type={file.type} purpose={file.purpose} />
                                <Text
                                  variant="bodySm"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                  }}
                                >
                                  {file.name}
                                </Text>
                                <Button
                                  icon={XIcon}
                                  tone="critical"
                                  variant="plain"
                                  size="slim"
                                  onClick={() => removeFileFromLicense(fileId, tier.id)}
                                  disabled={uploading}
                                  accessibilityLabel={`Remove ${file.name} from ${tier.name}`}
                                />
                              </div>
                            );
                          })}
                        </BlockStack>
                      )}
                    </div>

                    {/* Add File Button */}
                    <Popover
                      active={activePopover === tier.id}
                      activator={
                        <Button
                          fullWidth
                          icon={PlusIcon}
                          onClick={() => setActivePopover(activePopover === tier.id ? null : tier.id)}
                          disabled={unassignedFiles.length === 0 || uploading}
                        >
                          Add File
                        </Button>
                      }
                      onClose={() => setActivePopover(null)}
                    >
                      <ActionList
                        actionRole="menuitem"
                        items={unassignedFiles.map((file) => ({
                          content: (
                            <InlineStack gap="200" align="center">
                              <FileTypeBadge type={file.type} purpose={file.purpose} />
                              <Text variant="bodySm">{file.name}</Text>
                            </InlineStack>
                          ),
                          onAction: () => addFileToLicense(file.id, tier.id),
                        }))}
                      />
                    </Popover>

                    {/* Recommended badges */}
                    <BlockStack gap="100">
                      {style.recommendedFiles.map((recType) => {
                        const hasType = tierFiles.some((fid) => getFile(fid)?.type === recType);
                        if (hasType) return null;
                        return (
                          <Badge key={recType} tone="warning">
                            Recommended: {recType.toUpperCase()}
                          </Badge>
                        );
                      })}
                    </BlockStack>
                  </BlockStack>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Summary
              </Text>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${licenses.length}, 1fr)`,
                  gap: '16px',
                }}
              >
                {licenses.map((tier) => {
                  const count = (licenseFiles[tier.id] || []).length;
                  return (
                    <div
                      key={tier.id}
                      style={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: count > 0 ? '#F0FDF4' : '#FEF3C7',
                        borderRadius: '8px',
                        border: `1px solid ${count > 0 ? '#BBF7D0' : '#FCD34D'}`,
                      }}
                    >
                      <Text variant="bodySm" tone="subdued">
                        {tier.name}
                      </Text>
                      <Text variant="headingLg" as="p" fontWeight="bold">
                        {count}
                      </Text>
                      <Text variant="bodyXs" tone="subdued">
                        files
                      </Text>
                    </div>
                  );
                })}
              </div>

              {!previewFile && (
                <Banner tone="warning">Please upload a preview audio file.</Banner>
              )}

              {!isComplete() && (
                <Banner tone="warning">
                  Please assign at least one file to each license tier.
                </Banner>
              )}
            </BlockStack>
          </Card>
        </>
      )}
    </BlockStack>
  );
}

export default LicenseFileAssignment;
