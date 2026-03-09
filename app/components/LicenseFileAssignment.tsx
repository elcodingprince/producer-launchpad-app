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
} from '@shopify/polaris-icons';
import { validateUploadFile, ALLOWED_FILE_TYPES } from '../services/bunnyCdn';

// File type badge component - defined outside main component for performance
const FileTypeBadge = memo(({ type }: { type: string }) => {
  const FILE_TYPES: Record<string, { label: string; icon: string; color: string }> = {
    mp3: { label: 'MP3', icon: '🎵', color: '#10B981' },
    wav: { label: 'WAV', icon: '🎼', color: '#3B82F6' },
    stems: { label: 'Stems', icon: '📦', color: '#F59E0B' },
    cover: { label: 'Cover Art', icon: '🖼️', color: '#EC4899' },
    other: { label: 'File', icon: '📄', color: '#6B7280' },
  };

  const config = FILE_TYPES[type] || FILE_TYPES.other;
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
  type: 'mp3' | 'wav' | 'stems' | 'cover' | 'other';
  size: string;
  file?: File; // Original file object for upload
  storageUrl?: string; // Set after successful upload
}

// License file mapping
export interface LicenseFiles {
  [tierId: string]: string[]; // tierId -> array of fileIds
}

// Component props
export interface LicenseFileAssignmentProps {
  licenses: LicenseTier[];
  uploadedFiles?: UploadedFile[];
  licenseFiles?: LicenseFiles;
  onChange?: (data: {
    uploadedFiles: UploadedFile[];
    licenseFiles: LicenseFiles;
  }) => void;
  onUpload?: (files: File[]) => Promise<UploadedFile[]>;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

// Default license tier styling - defined outside component
const DEFAULT_TIER_STYLES: Record<string, { color: string; icon: string; recommendedFiles: string[] }> = {
  basic: { color: '#0066FF', icon: '🔷', recommendedFiles: ['mp3'] },
  premium: { color: '#8B5CF6', icon: '💎', recommendedFiles: ['mp3', 'wav'] },
  unlimited: { color: '#F59E0B', icon: '👑', recommendedFiles: ['mp3', 'wav', 'stems'] },
};

// Helper function defined outside component
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
  onChange,
  onUpload,
  uploading = false,
  uploadProgress,
  error,
}: LicenseFileAssignmentProps) {
  // Internal state for uncontrolled usage
  const [internalFiles, setInternalFiles] = useState<UploadedFile[]>([]);
  const [internalLicenseFiles, setInternalLicenseFiles] = useState<LicenseFiles>({
    basic: [],
    premium: [],
    unlimited: [],
  });
  
  // Use external state if provided, otherwise internal
  const uploadedFiles = externalFiles ?? internalFiles;
  const licenseFiles = externalLicenseFiles ?? internalLicenseFiles;
  
  // Popover state
  const [activePopover, setActivePopover] = useState<string | null>(null);
  
  // Rejected files state
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ file: File; error: string }>>([]);

  // Update state helper
  const updateState = useCallback((newFiles: UploadedFile[], newLicenseFiles: LicenseFiles) => {
    if (onChange) {
      onChange({ uploadedFiles: newFiles, licenseFiles: newLicenseFiles });
    } else {
      setInternalFiles(newFiles);
      setInternalLicenseFiles(newLicenseFiles);
    }
  }, [onChange]);

  // Detect file type from extension
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

  // Handle file drop with validation
  const handleDrop = useCallback(async (
    _dropFiles: File[],
    acceptedFiles: File[],
    rejectedFilesInput: File[]
  ) => {
    // Handle rejected files
    if (rejectedFilesInput.length > 0) {
      setRejectedFiles(rejectedFilesInput.map(file => ({
        file,
        error: 'File type not supported',
      })));
      return;
    }

    // Validate each accepted file
    const validFiles: UploadedFile[] = [];
    const invalidFiles: Array<{ file: File; error: string }> = [];

    for (const file of acceptedFiles) {
      const validation = validateUploadFile(file, ALLOWED_FILE_TYPES);
      if (validation.valid) {
        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: detectFileType(file.name),
          size: formatFileSize(file.size),
          file, // Keep reference for upload
        });
      } else {
        invalidFiles.push({ file, error: validation.error || 'Invalid file' });
      }
    }

    if (invalidFiles.length > 0) {
      setRejectedFiles(invalidFiles);
      return;
    }

    // Upload files if onUpload handler provided
    if (onUpload && validFiles.length > 0) {
      try {
        const filesToUpload = validFiles.map(f => f.file).filter((f): f is File => f !== undefined);
        const filesWithUrls = await onUpload(filesToUpload);
        const updatedFiles = [...uploadedFiles, ...filesWithUrls];
        updateState(updatedFiles, licenseFiles);
      } catch (err) {
        setRejectedFiles(validFiles.map(f => ({
          file: f.file,
          error: err instanceof Error ? err.message : 'Upload failed',
        })).filter((r): r is { file: File; error: string } => r.file !== undefined));
      }
    } else {
      // Just add to state without uploading
      const updatedFiles = [...uploadedFiles, ...validFiles];
      updateState(updatedFiles, licenseFiles);
    }

    // Clear rejected files after successful drop
    setRejectedFiles([]);
  }, [uploadedFiles, licenseFiles, onUpload, detectFileType, formatFileSize, updateState]);

  // Add file to license tier
  const addFileToLicense = useCallback((fileId: string, tierId: string) => {
    const updatedLicenseFiles = {
      ...licenseFiles,
      [tierId]: [...(licenseFiles[tierId] || []), fileId],
    };
    updateState(uploadedFiles, updatedLicenseFiles);
    setActivePopover(null);
  }, [uploadedFiles, licenseFiles, updateState]);

  // Remove file from license tier
  const removeFileFromLicense = useCallback((fileId: string, tierId: string) => {
    const updatedLicenseFiles = {
      ...licenseFiles,
      [tierId]: (licenseFiles[tierId] || []).filter((id) => id !== fileId),
    };
    updateState(uploadedFiles, updatedLicenseFiles);
  }, [uploadedFiles, licenseFiles, updateState]);

  // Remove file entirely
  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = uploadedFiles.filter((f) => f.id !== fileId);
    const updatedLicenseFiles: LicenseFiles = {};
    
    // Remove from all license tiers
    Object.keys(licenseFiles).forEach((tierId) => {
      updatedLicenseFiles[tierId] = licenseFiles[tierId].filter((id) => id !== fileId);
    });
    
    updateState(updatedFiles, updatedLicenseFiles);
  }, [uploadedFiles, licenseFiles, updateState]);

  // Get file by ID
  const getFile = useCallback((fileId: string) => {
    return uploadedFiles.find((f) => f.id === fileId);
  }, [uploadedFiles]);

  // Get files not yet assigned to a tier
  const getUnassignedFiles = useCallback((tierId: string) => {
    const assignedToTier = licenseFiles[tierId] || [];
    return uploadedFiles.filter((f) => !assignedToTier.includes(f.id));
  }, [uploadedFiles, licenseFiles]);

  // Check if all tiers have minimum required files
  const isComplete = useCallback(() => {
    return licenses.every((license) => (licenseFiles[license.id]?.length || 0) > 0);
  }, [licenses, licenseFiles]);

  return (
    <BlockStack gap="600">
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <Text variant="headingXl" as="h1">
          Assign Files to Licenses
        </Text>
        <Text variant="bodyMd" tone="subdued">
          Upload once, assign to multiple license tiers
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

      {/* File Upload Zone */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Step 1: Upload Your Files
          </Text>

          <DropZone
            onDrop={handleDrop}
            accept=".mp3,.wav,.zip,.jpg,.jpeg,.png"
            type="file"
            allowMultiple
            disabled={uploading}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px' }}>
                <Spinner size="large" />
                <Text variant="bodyMd">Uploading...</Text>
                {uploadProgress !== undefined && (
                  <Text variant="bodySm" tone="subdued">
                    {uploadProgress}%
                  </Text>
                )}
              </div>
            ) : (
              <DropZone.FileUpload actionHint="Accepts .mp3, .wav, .zip, .jpg, .png up to 500MB" />
            )}
          </DropZone>

          {/* Uploaded Files List */}
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
                  <FileTypeBadge type={file.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodySm" fontWeight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    onClick={() => removeFile(file.id)}
                    disabled={uploading}
                    accessibilityLabel={`Remove ${file.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </BlockStack>
      </Card>

      {/* License Assignment Cards */}
      {uploadedFiles.length > 0 && (
        <>
          <Text variant="headingMd" as="h2">
            Step 2: Assign to License Tiers
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
                                <FileTypeBadge type={file.type} />
                                <Text variant="bodySm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {file.name}
                                </Text>
                                <div style={{ flex: 1 }} />
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
                              <FileTypeBadge type={file.type} />
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
                        const hasType = tierFiles.some(
                          (fid) => getFile(fid)?.type === recType
                        );
                        if (hasType) return null;
                        return (
                          <Badge key={recType} tone="warning">
                            Recommended: {FILE_TYPES[recType]?.label || recType}
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

              {!isComplete() && (
                <Banner tone="warning">
                  Please assign at least one file to each license tier before publishing.
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
