import { useState, useCallback } from 'react';
import {
  Card,
  Button,
  DropZone,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  Icon,
  ActionList,
  Popover,
  Banner,
} from '@shopify/polaris';
import {
  SoundIcon,
  ImageIcon,
  PlusIcon,
  XIcon,
  DragHandleIcon,
  PackageIcon,
} from '@shopify/polaris-icons';

// License tier configuration
const LICENSE_TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$29.99',
    color: '#0066FF',
    icon: '🔷',
    description: 'MP3 for personal use',
    recommendedFiles: ['mp3'],
  },
  {
    id: 'premium', 
    name: 'Premium',
    price: '$49.99',
    color: '#8B5CF6',
    icon: '💎',
    description: 'MP3 + WAV for commercial use',
    recommendedFiles: ['mp3', 'wav'],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: '$99.99',
    color: '#F59E0B',
    icon: '👑',
    description: 'Full package + stems',
    recommendedFiles: ['mp3', 'wav', 'stems'],
  },
];

// File type definitions
const FILE_TYPES = {
  mp3: { label: 'MP3', icon: '🎵', color: '#10B981' },
  wav: { label: 'WAV', icon: '🎼', color: '#3B82F6' },
  stems: { label: 'Stems', icon: '📦', color: '#F59E0B' },
  cover: { label: 'Cover Art', icon: '🖼️', color: '#EC4899' },
};

export function LicenseFileAssignment() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [licenseFiles, setLicenseFiles] = useState({
    basic: [],
    premium: [],
    unlimited: [],
  });
  const [activePopover, setActivePopover] = useState(null);
  const [rejectedFiles, setRejectedFiles] = useState([]);

  // Handle file drop
  const handleDrop = useCallback((files, acceptedFiles, rejectedFiles) => {
    const newFiles = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      type: detectFileType(file.name),
      size: formatFileSize(file.size),
      file,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    
    if (rejectedFiles.length > 0) {
      setRejectedFiles(rejectedFiles);
    }
  }, []);

  // Detect file type from extension
  const detectFileType = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'mp3') return 'mp3';
    if (ext === 'wav') return 'wav';
    if (ext === 'zip') return 'stems';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'cover';
    return 'other';
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Add file to license tier
  const addFileToLicense = (fileId, tierId) => {
    setLicenseFiles((prev) => ({
      ...prev,
      [tierId]: [...prev[tierId], fileId],
    }));
    setActivePopover(null);
  };

  // Remove file from license tier
  const removeFileFromLicense = (fileId, tierId) => {
    setLicenseFiles((prev) => ({
      ...prev,
      [tierId]: prev[tierId].filter((id) => id !== fileId),
    }));
  };

  // Get file by ID
  const getFile = (fileId) => uploadedFiles.find((f) => f.id === fileId);

  // Get files not yet assigned to a tier
  const getUnassignedFiles = (tierId) => {
    const assignedToTier = licenseFiles[tierId];
    return uploadedFiles.filter((f) => !assignedToTier.includes(f.id));
  };

  // Check if all tiers have minimum required files
  const isComplete = () => {
    return licenseFiles.basic.length > 0 && 
           licenseFiles.premium.length > 0 && 
           licenseFiles.unlimited.length > 0;
  };

  // File type badge
  const FileTypeBadge = ({ type }) => {
    const config = FILE_TYPES[type] || { label: type.toUpperCase(), icon: '📄', color: '#6B7280' };
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
  };

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
          >
            <DropZone.FileUpload
              actionHint="Accepts .mp3, .wav, .zip, .jpg, .png"
            />
          </DropZone>

          {rejectedFiles.length > 0 && (
            <Banner tone="warning" onDismiss={() => setRejectedFiles([])}>
              Some files were rejected. Only audio files (.mp3, .wav), 
              ZIP archives, and images are allowed.
            </Banner>
          )}

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
                    <Text variant="bodySm" fontWeight="medium" truncate>
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
                    onClick={() => {
                      setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
                      // Also remove from all licenses
                      setLicenseFiles((prev) => ({
                        basic: prev.basic.filter((id) => id !== file.id),
                        premium: prev.premium.filter((id) => id !== file.id),
                        unlimited: prev.unlimited.filter((id) => id !== file.id),
                      }));
                    }}
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
            {LICENSE_TIERS.map((tier) => (
              <Card key={tier.id}>
                <BlockStack gap="400">
                  {/* Tier Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingBottom: '12px',
                      borderBottom: `2px solid ${tier.color}`,
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{tier.icon}</span>
                    <div style={{ flex: 1 }}>
                      <InlineStack align="space-between">
                        <Text variant="headingMd" as="h3">
                          {tier.name}
                        </Text>
                        <Text
                          variant="headingMd"
                          as="span"
                          tone="success"
                          fontWeight="bold"
                        >
                          {tier.price}
                        </Text>
                      </InlineStack>
                      <Text variant="bodySm" tone="subdued">
                        {tier.description}
                      </Text>
                    </div>
                  </div>

                  {/* Files in this tier */}
                  <div style={{ minHeight: '100px' }}>
                    {licenseFiles[tier.id].length === 0 ? (
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
                        {licenseFiles[tier.id].map((fileId) => {
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
                              <Text variant="bodySm" truncate>
                                {file.name}
                              </Text>
                              <div style={{ flex: 1 }} />
                              <Button
                                icon={XIcon}
                                tone="critical"
                                variant="plain"
                                size="slim"
                                onClick={() => removeFileFromLicense(fileId, tier.id)}
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
                        disabled={getUnassignedFiles(tier.id).length === 0}
                      >
                        Add File
                      </Button>
                    }
                    onClose={() => setActivePopover(null)}
                  >
                    <ActionList
                      actionRole="menuitem"
                      items={getUnassignedFiles(tier.id).map((file) => ({
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

                  {/* Recommended badge */}
                  {tier.recommendedFiles.map((recType) => {
                    const hasType = licenseFiles[tier.id].some(
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
              </Card>
            ))}
          </div>

          {/* Summary & Submit */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Summary
              </Text>
              
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                }}
              >
                {LICENSE_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    style={{
                      textAlign: 'center',
                      padding: '16px',
                      backgroundColor: licenseFiles[tier.id].length > 0 ? '#F0FDF4' : '#FEF3C7',
                      borderRadius: '8px',
                      border: `1px solid ${licenseFiles[tier.id].length > 0 ? '#BBF7D0' : '#FCD34D'}`,
                    }}
                  >
                    <Text variant="bodySm" tone="subdued">
                      {tier.name}
                    </Text>
                    <Text variant="headingLg" as="p" fontWeight="bold">
                      {licenseFiles[tier.id].length}
                    </Text>
                    <Text variant="bodyXs" tone="subdued">
                      files
                    </Text>
                  </div>
                ))}
              </div>

              {!isComplete() && (
                <Banner tone="warning">
                  Please assign at least one file to each license tier before publishing.
                </Banner>
              )}

              <Button
                variant="primary"
                size="large"
                fullWidth
                disabled={!isComplete()}
              >
                {isComplete() ? 'Create Beat Product' : 'Assign files to continue...'}
              </Button>
            </BlockStack>
          </Card>
        </>
      )}
    </BlockStack>
  );
}

export default LicenseFileAssignment;
