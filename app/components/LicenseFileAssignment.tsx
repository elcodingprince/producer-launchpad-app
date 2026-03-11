import { useState, useCallback, useRef, memo } from 'react';
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
  Popover,
  OptionList,
  Box,
  Divider,
  Tag,
  TextField,
} from '@shopify/polaris';
import {
  XIcon,
  SoundIcon,
  PlayCircleIcon,
  AlertDiamondIcon,
  PackageIcon,
  StarFilledIcon,
  CheckCircleIcon,
  ImageIcon,
  PlusIcon,
} from '@shopify/polaris-icons';
import { validateUploadFile, ALLOWED_FILE_TYPES } from '../services/bunnyCdn';

// ── File type icon badge — Polaris-native pattern from setup wizard ──────────
const FileTypeChip = memo(({ type, purpose }: { type: string; purpose?: string }) => {
  type BgType = 'bg-surface-success' | 'bg-surface-warning' | 'bg-surface-magic' | 'bg-surface-secondary';
  type IconTone = 'success' | 'caution' | 'magic' | 'base';
  const MAP: Record<string, { bg: BgType; tone: IconTone; label: string; icon: any }> = {
    mp3:     { bg: 'bg-surface-success',   tone: 'success', label: 'MP3',     icon: SoundIcon },
    wav:     { bg: 'bg-surface-secondary', tone: 'base',    label: 'WAV',     icon: SoundIcon },
    stems:   { bg: 'bg-surface-warning',   tone: 'caution', label: 'Stems',   icon: PackageIcon },
    cover:   { bg: 'bg-surface-magic',     tone: 'magic',   label: 'Cover',   icon: ImageIcon },
    preview: { bg: 'bg-surface-magic',     tone: 'magic',   label: 'Preview', icon: PlayCircleIcon },
    other:   { bg: 'bg-surface-secondary', tone: 'base',    label: 'File',    icon: SoundIcon },
  };
  const c = MAP[purpose || type] || MAP.other;
  return (
    <InlineStack gap="150" blockAlign="center">
      <Box background={c.bg} padding="150" borderRadius="100">
        <Icon source={c.icon} tone={c.tone} />
      </Box>
      <Text as="span" variant="bodySm" fontWeight="semibold">{c.label}</Text>
    </InlineStack>
  );
});
FileTypeChip.displayName = 'FileTypeChip';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LicenseTier {
  id: string;
  name: string;
  price: string;
  description?: string;
  color?: string;
  recommendedFiles?: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'mp3' | 'wav' | 'stems' | 'cover' | 'preview' | 'other';
  purpose: 'preview' | 'mp3' | 'wav' | 'stems' | 'cover' | 'license_pdf' | 'other';
  size: string;
  file?: File;
  storageUrl?: string;
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
  onUpload?: (files: File[], purpose: 'preview' | 'license') => Promise<UploadedFile[]>;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

// ── Tier styles ──────────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<string, { icon: any; tint: 'info' | 'warning'; recommendedFiles: string[] }> = {
  basic:     { icon: AlertDiamondIcon, tint: 'info',    recommendedFiles: ['mp3']                  },
  premium:   { icon: AlertDiamondIcon, tint: 'info',    recommendedFiles: ['mp3', 'wav']            },
  unlimited: { icon: StarFilledIcon,   tint: 'warning', recommendedFiles: ['mp3', 'wav', 'stems']  },
};

const getTierMeta = (tier: LicenseTier) => {
  const d = TIER_DEFAULTS[tier.id.toLowerCase()] || { icon: CheckCircleIcon, tint: 'info', recommendedFiles: [] };
  return { icon: d.icon, tint: d.tint, recommendedFiles: tier.recommendedFiles || d.recommendedFiles };
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

  const [internalFiles, setInternalFiles]               = useState<UploadedFile[]>([]);
  const [internalLicenseFiles, setInternalLicenseFiles] = useState<LicenseFiles>({ basic: [], premium: [], unlimited: [] });
  const [internalLicensePrices, setInternalLicensePrices] = useState<Record<string, string>>({ basic: "29.99", premium: "49.99", unlimited: "99.99" });
  const [internalPreviewFile, setInternalPreviewFile]   = useState<UploadedFile | null>(null);
  const [internalCoverArtFile, setInternalCoverArtFile] = useState<UploadedFile | null>(null);
  const [popoverOpen, setPopoverOpen]                   = useState<string | null>(null);
  const [rejectedFiles, setRejectedFiles]               = useState<Array<{ file: File; error: string }>>([]);
  const [coverArtPreviewUrl, setCoverArtPreviewUrl]     = useState<string | null>(null);

  const uploadedFiles = externalFiles          ?? internalFiles;
  const licenseFiles  = externalLicenseFiles   ?? internalLicenseFiles;
  const licensePrices = externalLicensePrices  ?? internalLicensePrices;
  const previewFile   = externalPreviewFile    ?? internalPreviewFile;
  const coverArtFile  = externalCoverArtFile   ?? internalCoverArtFile;

  const updateState = useCallback((
    newFiles: UploadedFile[],
    newLicenseFiles: LicenseFiles,
    newPreviewFile: UploadedFile | null,
    newCoverArtFile: UploadedFile | null,
    newLicensePrices: Record<string, string>,
  ) => {
    if (onChange) {
      onChange({ uploadedFiles: newFiles, licenseFiles: newLicenseFiles, previewFile: newPreviewFile, coverArtFile: newCoverArtFile, licensePrices: newLicensePrices });
    } else {
      setInternalFiles(newFiles);
      setInternalLicenseFiles(newLicenseFiles);
      setInternalPreviewFile(newPreviewFile);
      setInternalCoverArtFile(newCoverArtFile);
      setInternalLicensePrices(newLicensePrices);
    }
  }, [onChange]);

  const detectFileType = useCallback((filename: string): UploadedFile['type'] => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'mp3') return 'mp3';
    if (ext === 'wav') return 'wav';
    if (ext === 'zip') return 'stems';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'cover';
    return 'other';
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Cover art
  const handleCoverArtDrop = useCallback((_: File[], accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) { setRejectedFiles([{ file: rejected[0], error: 'Use JPG or PNG.' }]); return; }
    const file = accepted[0];
    if (!file) return;
    const newFile: UploadedFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name, type: 'cover', purpose: 'cover', size: formatFileSize(file.size), file,
    };
    const url = URL.createObjectURL(file);
    setCoverArtPreviewUrl(url);
    updateState(uploadedFiles, licenseFiles, previewFile, newFile, licensePrices);
    setRejectedFiles([]);
  }, [uploadedFiles, licenseFiles, previewFile, licensePrices, formatFileSize, updateState]);

  const removeCoverArt = useCallback(() => {
    if (coverArtPreviewUrl) URL.revokeObjectURL(coverArtPreviewUrl);
    setCoverArtPreviewUrl(null);
    updateState(uploadedFiles, licenseFiles, previewFile, null, licensePrices);
  }, [uploadedFiles, licenseFiles, previewFile, licensePrices, coverArtPreviewUrl, updateState]);

  // Preview
  const handlePreviewDrop = useCallback(async (_: File[], accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) { setRejectedFiles([{ file: rejected[0], error: 'Use MP3.' }]); return; }
    const file = accepted[0];
    if (!file) return;
    const validation = validateUploadFile(file, ALLOWED_FILE_TYPES);
    if (!validation.valid) { setRejectedFiles([{ file, error: validation.error || 'Invalid file' }]); return; }
    const fileData: UploadedFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name, type: 'preview', purpose: 'preview', size: formatFileSize(file.size), file,
    };
    if (onUpload) {
      try {
        const uploaded = await onUpload([file], 'preview');
        updateState(uploadedFiles, licenseFiles, uploaded[0] || null, coverArtFile, licensePrices);
      } catch (err) {
        setRejectedFiles([{ file, error: err instanceof Error ? err.message : 'Upload failed' }]);
      }
    } else {
      updateState(uploadedFiles, licenseFiles, fileData, coverArtFile, licensePrices);
    }
    setRejectedFiles([]);
  }, [uploadedFiles, licenseFiles, coverArtFile, licensePrices, onUpload, formatFileSize, updateState]);

  // License files pool
  const handleLicenseFilesDrop = useCallback(async (_: File[], accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) { setRejectedFiles(rejected.map((f) => ({ file: f, error: 'File type not supported' }))); return; }
    const validFiles: UploadedFile[] = [];
    const invalidFiles: Array<{ file: File; error: string }> = [];
    for (const file of accepted) {
      const v = validateUploadFile(file, ALLOWED_FILE_TYPES);
      if (v.valid) {
        const fileType = detectFileType(file.name);
        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name, type: fileType,
          purpose: fileType === 'mp3' || fileType === 'wav' || fileType === 'stems' ? fileType : 'other',
          size: formatFileSize(file.size), file,
        });
      } else {
        invalidFiles.push({ file, error: v.error || 'Invalid file' });
      }
    }
    if (invalidFiles.length > 0) { setRejectedFiles(invalidFiles); return; }
    if (onUpload && validFiles.length > 0) {
      try {
        const uploaded = await onUpload(validFiles.map((f) => f.file!).filter(Boolean), 'license');
        updateState([...uploadedFiles, ...uploaded], licenseFiles, previewFile, coverArtFile, licensePrices);
      } catch (err) {
        setRejectedFiles(validFiles.map((f) => ({ file: f.file!, error: err instanceof Error ? err.message : 'Upload failed' })).filter((r) => r.file));
      }
    } else {
      updateState([...uploadedFiles, ...validFiles], licenseFiles, previewFile, coverArtFile, licensePrices);
    }
    setRejectedFiles([]);
  }, [uploadedFiles, licenseFiles, previewFile, coverArtFile, licensePrices, onUpload, detectFileType, formatFileSize, updateState]);

  const removePreviewFile  = useCallback(() => updateState(uploadedFiles, licenseFiles, null, coverArtFile, licensePrices), [uploadedFiles, licenseFiles, coverArtFile, licensePrices, updateState]);

  const removeLicenseFile = useCallback((fileId: string) => {
    const updated = uploadedFiles.filter((f) => f.id !== fileId);
    const updatedLF: LicenseFiles = {};
    Object.keys(licenseFiles).forEach((tid) => { updatedLF[tid] = licenseFiles[tid].filter((id) => id !== fileId); });
    updateState(updated, updatedLF, previewFile, coverArtFile, licensePrices);
  }, [uploadedFiles, licenseFiles, previewFile, coverArtFile, licensePrices, updateState]);

  // Handle "Add files" button click → hidden input
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      await handleLicenseFilesDrop(files, files, []);
      // reset so same file can be re-selected
      if (licenseFilesInputRef.current) licenseFilesInputRef.current.value = '';
    },
    [handleLicenseFilesDrop]
  );

  const getFile = useCallback((id: string) => uploadedFiles.find((f) => f.id === id), [uploadedFiles]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BlockStack gap="500">
      {error && <Banner tone="critical"><p>{error}</p></Banner>}

      {rejectedFiles.length > 0 && (
        <Banner tone="warning" onDismiss={() => setRejectedFiles([])} action={{ content: 'Clear', onAction: () => setRejectedFiles([]) }}>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" fontWeight="semibold">Some files could not be added:</Text>
            {rejectedFiles.map((r, i) => <Text as="p" key={i} variant="bodySm">• {r.file.name}: {r.error}</Text>)}
          </BlockStack>
        </Banner>
      )}



      {/* ── Media ── */}
      <Card>
        <BlockStack gap="500">
          <Text variant="headingMd" as="h2">Media</Text>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '24px', alignItems: 'start' }}>

            {/* Left — Cover Art */}
            <BlockStack gap="200">
              <Text variant="bodySm" as="p" tone="subdued">Cover Art</Text>
              {!coverArtFile ? (
                <div style={{ height: '160px' }}>
                  <DropZone onDrop={handleCoverArtDrop} accept="image/jpeg,image/png,image/webp" type="image" allowMultiple={false} disabled={uploading}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '16px' }}>
                      <Icon source={ImageIcon} tone="base" />
                      <Text as="span" variant="bodyXs" tone="subdued" alignment="center">Add image</Text>
                    </div>
                  </DropZone>
                </div>
              ) : (
                <div style={{ position: 'relative', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--p-color-border)' }}>
                  {coverArtPreviewUrl
                    ? <img src={coverArtPreviewUrl} alt="Cover art" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--p-color-bg-surface-secondary)' }}><Icon source={ImageIcon} tone="base" /></div>
                  }
                  <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
                    <Button icon={XIcon} variant="plain" onClick={removeCoverArt} disabled={uploading} accessibilityLabel="Remove cover art" />
                  </div>
                </div>
              )}
            </BlockStack>

            {/* Right — Preview + License Files */}
            <BlockStack gap="500">

              {/* Preview Audio */}
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h3">Preview audio</Text>
                    <Text as="span" variant="bodySm" tone="subdued">(required)</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Watermarked MP3 for your storefront player. Not included in any license package.
                  </Text>
                </BlockStack>

                {!previewFile ? (
                  <DropZone onDrop={handlePreviewDrop} accept="audio/mpeg" type="file" allowMultiple={false} disabled={uploading}>
                    {uploading
                      ? <Box padding="400"><InlineStack align="center" gap="200"><Spinner size="small" /><Text as="span" variant="bodySm">Uploading…</Text></InlineStack></Box>
                      : <DropZone.FileUpload actionTitle="Add preview MP3" actionHint=".mp3 only" />
                    }
                  </DropZone>
                ) : (
                  <Box borderWidth="025" borderColor="border" borderRadius="200" padding="300">
                    <InlineStack gap="300" blockAlign="center">
                      <FileTypeChip type="preview" purpose="preview" />
                      <BlockStack gap="0">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                          <Text as="span" variant="bodySm" fontWeight="medium">{previewFile.name}</Text>
                        </div>
                        <Text as="span" variant="bodyXs" tone="subdued">{previewFile.size}</Text>
                      </BlockStack>
                      <Button icon={XIcon} variant="plain" onClick={removePreviewFile} disabled={uploading} accessibilityLabel="Remove preview" />
                    </InlineStack>
                  </Box>
                )}
              </BlockStack>

              <Divider />

              {/* License Files */}
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">License files</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Upload once, then assign to each license package below.
                    </Text>
                  </BlockStack>
                  {uploadedFiles.length > 0 && !uploading && (
                    <>
                      <Button icon={PlusIcon} onClick={() => licenseFilesInputRef.current?.click()}>
                        Add files
                      </Button>
                      <input
                        ref={licenseFilesInputRef}
                        type="file"
                        multiple
                        accept=".mp3,.wav,.zip"
                        style={{ display: 'none' }}
                        onChange={handleFileInputChange}
                      />
                    </>
                  )}
                </InlineStack>

                {uploadedFiles.length === 0 ? (
                  <DropZone onDrop={handleLicenseFilesDrop} accept=".mp3,.wav,.zip" type="file" allowMultiple disabled={uploading}>
                    {uploading
                      ? <Box padding="600"><BlockStack gap="200" inlineAlign="center"><Spinner size="large" /><Text as="p" variant="bodyMd">Uploading…</Text></BlockStack></Box>
                      : <DropZone.FileUpload actionHint=".mp3, .wav, .zip" />
                    }
                  </DropZone>
                ) : (
                  <BlockStack gap="200">
                    {uploadedFiles.map((file) => (
                      <Box key={file.id} borderWidth="025" borderColor="border" borderRadius="200" padding="300">
                        <InlineStack gap="300" blockAlign="center">
                          <FileTypeChip type={file.type} purpose={file.purpose} />
                          <BlockStack gap="0">
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                              <Text as="span" variant="bodySm" fontWeight="medium">{file.name}</Text>
                            </div>
                            <Text as="span" variant="bodyXs" tone="subdued">{file.size}</Text>
                          </BlockStack>
                          <Button icon={XIcon} variant="plain" onClick={() => removeLicenseFile(file.id)} disabled={uploading} accessibilityLabel={`Remove ${file.name}`} />
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>

            </BlockStack>
          </div>
        </BlockStack>
      </Card>

      {/* ── License packages — Shopify Variants Table Layout ── */}
      <Card padding="0">
        <Box padding="400" paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
          <Text variant="headingMd" as="h2">Beat licenses</Text>
        </Box>

        <Box padding="0">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--p-color-bg-surface-secondary)', borderBottom: '1px solid var(--p-color-border)' }}>
                  <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)', width: '25%' }}>Variant</th>
                  <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)', width: '25%' }}>Price</th>
                  <th style={{ padding: '8px 16px', fontWeight: 500, fontSize: '13px', color: 'var(--p-color-text-subdued)', width: '50%' }}>Assigned license files</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((tier, index) => {
                  const meta = getTierMeta(tier);
                  const isNotLast = index < licenses.length - 1;
                  const isPopoverOpen = popoverOpen === tier.id;
                  const tierFiles = licenseFiles[tier.id] || [];

                  return (
                    <tr key={tier.id} style={{ borderBottom: isNotLast ? '1px solid var(--p-color-border)' : 'none' }}>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <InlineStack gap="300" blockAlign="center">
                          <Box background="bg-surface" borderWidth="025" borderColor="border" borderRadius="200" padding="150">
                            <Icon source={meta.icon} tone={meta.tint} />
                          </Box>
                          <Text variant="bodyMd" as="span" fontWeight="medium">{tier.name}</Text>
                        </InlineStack>
                        {meta.recommendedFiles.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <Text as="span" variant="bodyXs" tone="subdued">
                              Recommended: {meta.recommendedFiles.join(', ').toUpperCase()}
                            </Text>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: '140px' }}>
                          <TextField
                            label="Price"
                            labelHidden
                            autoComplete="off"
                            prefix="$"
                            value={licensePrices[tier.id] || ''}
                            onChange={(val) => {
                              const updated = { ...licensePrices, [tier.id]: val };
                              updateState(uploadedFiles, licenseFiles, previewFile, coverArtFile, updated);
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <Popover
                          active={isPopoverOpen}
                          activator={
                            <div
                              onClick={() => uploadedFiles.length > 0 && setPopoverOpen(isPopoverOpen ? null : tier.id)}
                              style={{
                                padding: '8px 12px',
                                border: isPopoverOpen ? '2px solid var(--p-color-border-interactive)' : '1px solid var(--p-color-border)',
                                borderRadius: '8px',
                                cursor: uploadedFiles.length === 0 ? 'not-allowed' : 'pointer',
                                backgroundColor: uploadedFiles.length === 0 ? 'var(--p-color-bg-surface-disabled)' : 'var(--p-color-bg-surface)',
                                minHeight: '36px',
                                display: 'flex',
                                flexWrap: 'wrap' as const,
                                gap: '8px',
                                alignItems: 'center',
                              }}
                            >
                              {tierFiles.length > 0 ? (
                                <InlineStack gap="200" wrap>
                                  {tierFiles.map((fileId) => {
                                    const file = getFile(fileId);
                                    if (!file) return null;
                                    return (
                                      <Tag
                                        key={fileId}
                                        onRemove={() => {
                                          const updated = { ...licenseFiles, [tier.id]: (licenseFiles[tier.id] || []).filter((id) => id !== fileId) };
                                          updateState(uploadedFiles, updated, previewFile, coverArtFile, licensePrices);
                                        }}
                                      >
                                        {file.type.toUpperCase()}
                                      </Tag>
                                    );
                                  })}
                                </InlineStack>
                              ) : (
                                <Text as="span" variant="bodySm" tone={uploadedFiles.length === 0 ? 'disabled' : 'subdued'}>
                                  {uploadedFiles.length === 0 ? 'Upload license files above first' : 'Click to assign files…'}
                                </Text>
                              )}
                            </div>
                          }
                          onClose={() => setPopoverOpen(null)}
                          autofocusTarget="none"
                          fullWidth
                        >
                          <Box minWidth="300px">
                            <OptionList
                              title={`Select files for ${tier.name}`}
                              onChange={(selectedIds) => {
                                const updated = { ...licenseFiles, [tier.id]: selectedIds };
                                updateState(uploadedFiles, updated, previewFile, coverArtFile, licensePrices);
                              }}
                              options={uploadedFiles.map((file) => ({ value: file.id, label: file.name }))}
                              selected={tierFiles}
                              allowMultiple
                            />
                          </Box>
                        </Popover>
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
