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
  Icon,
  OptionList,
} from '@shopify/polaris';
import {
  PlusIcon,
  XIcon,
  SoundIcon,
  PlayCircleIcon,
  AlertDiamondIcon,
  PackageIcon,
  StarFilledIcon,
  CheckCircleIcon,
} from '@shopify/polaris-icons';
import { validateUploadFile, ALLOWED_FILE_TYPES } from '../services/bunnyCdn';

// File type badge component - defined outside main component for performance
const FileTypeBadge = memo(({ type, purpose, iconTheme = false }: { type: string; purpose?: string; iconTheme?: boolean }) => {
  const FILE_TYPES: Record<string, { label: string; icon: any; color: string; tint: "success" | "info" | "warning" | "critical" }> = {
    mp3: { label: 'MP3', icon: SoundIcon, color: '#10B981', tint: 'success' },
    wav: { label: 'WAV', icon: SoundIcon, color: '#3B82F6', tint: 'info' },
    stems: { label: 'Stems', icon: PackageIcon, color: '#F59E0B', tint: 'warning' },
    cover: { label: 'Cover Art', icon: StarFilledIcon, color: '#EC4899', tint: 'info' },
    preview: { label: 'Preview', icon: PlayCircleIcon, color: '#8B5CF6', tint: 'info' },
    other: { label: 'File', icon: SoundIcon, color: '#6B7280', tint: 'info' },
  };

  const config = FILE_TYPES[purpose || type] || FILE_TYPES.other;

  if (iconTheme) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: `${config.color}20`, padding: '4px 8px', borderRadius: '4px' }}>
        <Icon source={config.icon} tone={config.tint} />
        <Text as="span" variant="bodySm" fontWeight="bold"><span style={{ color: config.color }}>{config.label}</span></Text>
      </div>
    );
  }

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
      <Icon source={config.icon} tone={config.tint} />
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
const DEFAULT_TIER_STYLES: Record<string, { color: string; icon: any; tint: "info" | "warning"; recommendedFiles: string[] }> = {
  basic: { color: '#0066FF', icon: AlertDiamondIcon, tint: 'info', recommendedFiles: ['mp3'] },
  premium: { color: '#8B5CF6', icon: AlertDiamondIcon, tint: 'info', recommendedFiles: ['mp3', 'wav'] },
  unlimited: { color: '#F59E0B', icon: StarFilledIcon, tint: 'warning', recommendedFiles: ['mp3', 'wav', 'stems'] },
};

// Helper function
const getTierStyle = (tier: LicenseTier) => {
  const defaultStyle = DEFAULT_TIER_STYLES[tier.id.toLowerCase()] || {
    color: '#6B7280',
    icon: CheckCircleIcon,
    tint: 'info',
    recommendedFiles: [],
  };
  return {
    color: tier.color || defaultStyle.color,
    icon: defaultStyle.icon,
    tint: defaultStyle.tint,
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
    <BlockStack gap="500">
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
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Some files could not be added:
            </Text>
            {rejectedFiles.map((rejected, index) => (
              <Text as="p" key={index} variant="bodySm">
                • {rejected.file.name}: {rejected.error}
              </Text>
            ))}
          </BlockStack>
        </Banner>
      )}

      {/* Media Card */}
      <Card>
        <BlockStack gap="500">
          <div>
            <Text variant="headingMd" as="h2">
              Media Files
            </Text>
          </div>

          <BlockStack gap="300">
            <div>
              <Text variant="headingSm" as="h3">
                Preview Audio (Required)
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
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
                  <Text as="span" variant="bodyMd">Uploading preview...</Text>
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
              <FileTypeBadge type="preview" purpose="preview" iconTheme={true} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text as="span" variant="bodySm" fontWeight="medium">
                  {previewFile.name}
                </Text>
                <Text as="span" variant="bodyXs" tone="subdued">
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

        <hr style={{ border: 'none', borderTop: '1px solid var(--p-color-border)', margin: '8px 0' }} />

          <BlockStack gap="300">
            <div>
              <Text variant="headingSm" as="h3">
                License Files
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
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
                <Text as="p" variant="bodyMd">Uploading...</Text>
                {uploadProgress !== undefined && (
                  <Text as="span" variant="bodySm" tone="subdued">{uploadProgress}%</Text>
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
                  <FileTypeBadge type={file.type} purpose={file.purpose} iconTheme={true} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Text as="span" variant="bodySm" fontWeight="medium">
                        {file.name}
                      </Text>
                    </div>
                    <Text as="span" variant="bodyXs" tone="subdued">
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
        </BlockStack>
      </Card>

      {/* License Configuration & File Assignments */}
      {uploadedFiles.length > 0 && (
        <Card padding="0">
          <BlockStack gap="0">
            {/* Top section: Variants definitions */}
            <div style={{ padding: '16px' }}>
              <Text variant="headingMd" as="h2">
                Beat Licenses
              </Text>
              
              <div style={{ marginTop: '16px', border: '1px solid var(--p-color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--p-color-bg-surface-secondary)', borderBottom: '1px solid var(--p-color-border)' }}>
                      <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '500', fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Variant</th>
                      <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '500', fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Price</th>
                      <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '500', fontSize: '13px', color: 'var(--p-color-text-subdued)' }}>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((tier, index) => {
                      const style = getTierStyle(tier);
                      return (
                        <tr key={tier.id} style={{ borderBottom: index < licenses.length - 1 ? '1px solid var(--p-color-border)' : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <InlineStack gap="300" align="start" blockAlign="center">
                              <div style={{ width: '32px', height: '32px', border: '1px solid var(--p-color-border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                                <Icon source={style.icon} tone={style.tint} />
                              </div>
                              <Text variant="bodyMd" as="span" fontWeight="medium">{tier.name}</Text>
                            </InlineStack>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Text variant="bodyMd" as="span">{tier.price}</Text>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Text variant="bodyMd" as="span" tone="subdued">-</Text>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--p-color-border)' }}></div>

            {/* Bottom section: File Assignments */}
            <div style={{ padding: '16px', backgroundColor: 'var(--p-color-bg-surface-secondary)' }}>
               <Text variant="headingMd" as="h2">Assign Files</Text>
               <div style={{ marginTop: '16px' }}>
                 <BlockStack gap="400">
                   {licenses.map(tier => {
                     const tierFiles = licenseFiles[tier.id] || [];
                     return (
                       <div key={tier.id}>
                         <div style={{ marginBottom: '4px' }}>
                            <Text variant="bodyMd" as="p" fontWeight="medium">
                               {tier.name}
                            </Text>
                         </div>
                         <Popover
                           active={activePopover === tier.id}
                           activator={
                             <div
                               onClick={() => setActivePopover(activePopover === tier.id ? null : tier.id)}
                               style={{
                                 minHeight: '36px',
                                 border: activePopover === tier.id ? '2px solid var(--p-color-border-focus)' : '1px solid var(--p-color-border)',
                                 borderRadius: '6px',
                                 padding: '6px 8px',
                                 cursor: 'pointer',
                                 display: 'flex',
                                 flexWrap: 'wrap',
                                 gap: '8px',
                                 alignItems: 'center',
                                 backgroundColor: '#FFFFFF',
                                 boxShadow: activePopover === tier.id ? 'none' : 'inset 0 1px 0 0 rgba(0, 0, 0, 0.05)',
                                 transition: 'border-color 0.2s',
                               }}
                             >
                               {tierFiles.length > 0 ? (
                                 tierFiles.map(fileId => {
                                   const file = getFile(fileId);
                                   if (!file) return null;
                                   
                                   let iconSource = SoundIcon;
                                   if (file.type === 'stems') iconSource = PackageIcon;
                                   
                                   return (
                                     <div key={fileId} style={{ 
                                       display: 'inline-flex', 
                                       padding: '2px 6px', 
                                       backgroundColor: 'var(--p-color-bg-surface-secondary)', 
                                       borderRadius: '4px', 
                                       border: '1px solid var(--p-color-border-hover)', 
                                       alignItems: 'center', 
                                       gap: '4px' 
                                     }}>
                                        <Icon source={iconSource} tone="info" />
                                        <Text as="span" variant="bodySm" fontWeight="medium">{file.type.toUpperCase()}</Text>
                                        <div 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            removeFileFromLicense(fileId, tier.id); 
                                          }} 
                                          style={{ cursor: 'pointer', display: 'flex', marginLeft: '2px', borderLeft: '1px solid var(--p-color-border-hover)', paddingLeft: '4px' }}
                                        >
                                           <Icon source={XIcon} />
                                        </div>
                                     </div>
                                   );
                                 })
                               ) : (
                                 <Text as="span" tone="subdued">Select files</Text>
                               )}
                             </div>
                           }
                           onClose={() => setActivePopover(null)}
                           autofocusTarget="none"
                           fullWidth
                         >
                           <div style={{ minWidth: '300px' }}>
                             {uploadedFiles.length > 0 ? (
                               <OptionList
                                 title={`Select files for ${tier.name}`}
                                 onChange={(selectedIds) => {
                                   const updated = { ...licenseFiles, [tier.id]: selectedIds };
                                   if (onChange) {
                                     onChange({ uploadedFiles, licenseFiles: updated, previewFile });
                                   } else {
                                     updateState(uploadedFiles, updated, previewFile);
                                   }
                                 }}
                                 options={uploadedFiles.map(file => ({
                                   value: file.id,
                                   label: file.name,
                                 }))}
                                 selected={tierFiles}
                                 allowMultiple
                               />
                             ) : (
                               <div style={{ padding: '16px', textAlign: 'center' }}>
                                 <Text as="span" tone="subdued">No files uploaded yet.</Text>
                               </div>
                             )}
                           </div>
                         </Popover>
                         
                         {getTierStyle(tier).recommendedFiles.length > 0 && (
                           <div style={{ marginTop: '6px' }}>
                              <Text variant="bodySm" as="span" tone="subdued">
                                 Recommended: {getTierStyle(tier).recommendedFiles.join(', ').toUpperCase()}
                              </Text>
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </BlockStack>
               </div>
            </div>

            {/* Warnings */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--p-color-border)' }}>
              <BlockStack gap="300">
                {!previewFile && (
                  <Banner tone="warning">Please upload a preview audio file.</Banner>
                )}
                {!isComplete() && (
                  <Banner tone="warning">
                    Please assign at least one file to each license tier.
                  </Banner>
                )}
              </BlockStack>
            </div>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}

export default LicenseFileAssignment;
