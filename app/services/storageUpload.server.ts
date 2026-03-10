import { type BeatFileUpload, type UploadedBeatFiles } from "./bunnyCdn";
import {
  getManagedR2Credentials,
  getResolvedR2Credentials,
  getStorageConfig,
} from "./storageConfig.server";
import { uploadR2Object } from "./r2.server";

export interface DynamicFileUpload {
  file: File;
  fileType: string; // mp3, wav, stems, cover, other
  originalName: string;
}

export interface UploadedFileResult {
  id: string;
  originalName: string;
  storageUrl: string;
  fileType: string;
  size: number;
}

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function uploadSelfManagedR2(
  shop: string, 
  files: DynamicFileUpload[], 
  beatSlug: string
): Promise<UploadedFileResult[]> {
  const creds = await getResolvedR2Credentials(shop);
  const config = await getStorageConfig(shop);

  if (!creds || !config?.publicBaseUrl) {
    throw new Error("Self-managed storage is incomplete. Set Public Base URL and credentials in Storage & Delivery.");
  }

  const baseUrl = normalizeBaseUrl(config.publicBaseUrl);
  const results: UploadedFileResult[] = [];

  for (const fileData of files) {
    const { file, fileType, originalName } = fileData;
    const extension = originalName.split('.').pop() || '';
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${beatSlug}/${Date.now()}-${safeName}`;
    
    // Determine content type
    const contentTypeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      stems: 'application/zip',
      cover: file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      other: 'application/octet-stream',
    };
    const contentType = contentTypeMap[fileType] || 'application/octet-stream';

    await uploadR2Object({
      accountId: creds.accountId,
      bucketName: creds.bucketName,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      key,
      contentType,
      body: await file.arrayBuffer(),
    });

    results.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalName,
      storageUrl: `${baseUrl}/${key}`,
      fileType,
      size: file.size,
    });
  }

  return results;
}

async function uploadManagedR2(
  files: DynamicFileUpload[],
  beatSlug: string
): Promise<UploadedFileResult[]> {
  const creds = getManagedR2Credentials();
  if (!creds) {
    throw new Error(
      "Managed storage is not configured. Set CF_R2_ACCOUNT_ID, CF_R2_BUCKET_NAME, CF_R2_ACCESS_KEY_ID and CF_R2_SECRET_ACCESS_KEY in the app backend."
    );
  }

  const baseUrl = creds.publicBaseUrl
    ? normalizeBaseUrl(creds.publicBaseUrl)
    : `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucketName}`;
  const results: UploadedFileResult[] = [];

  for (const fileData of files) {
    const { file, fileType, originalName } = fileData;
    const safeName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const key = `${beatSlug}/${safeName}`;
    
    // Determine content type
    const contentTypeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      stems: 'application/zip',
      cover: file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      other: 'application/octet-stream',
    };
    const contentType = contentTypeMap[fileType] || 'application/octet-stream';

    await uploadR2Object({
      accountId: creds.accountId,
      bucketName: creds.bucketName,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      key,
      contentType,
      body: await file.arrayBuffer(),
    });

    results.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalName,
      storageUrl: `${baseUrl}/${key}`,
      fileType,
      size: file.size,
    });
  }

  return results;
}

/**
 * Upload multiple files dynamically for a shop
 * This supports the license tier file assignment feature
 */
export async function uploadDynamicFilesForShop(
  shop: string,
  files: DynamicFileUpload[],
  beatSlug: string
): Promise<UploadedFileResult[]> {
  const storageConfig = await getStorageConfig(shop);

  if (!storageConfig || storageConfig.status === "disconnected") {
    throw new Error("Storage is not configured. Go to Storage & Delivery first.");
  }

  if (files.length === 0) {
    return [];
  }

  if (storageConfig.mode === "self_managed") {
    return uploadSelfManagedR2(shop, files, beatSlug);
  }

  return uploadManagedR2(files, beatSlug);
}

// Legacy function for backward compatibility
async function uploadSelfManagedR2Legacy(shop: string, files: BeatFileUpload, beatSlug: string): Promise<UploadedBeatFiles> {
  const creds = await getResolvedR2Credentials(shop);
  const config = await getStorageConfig(shop);

  if (!creds || !config?.publicBaseUrl) {
    throw new Error("Self-managed storage is incomplete. Set Public Base URL and credentials in Storage & Delivery.");
  }

  const results: UploadedBeatFiles = {};
  const baseUrl = normalizeBaseUrl(config.publicBaseUrl);

  async function uploadFile(file: File, name: string, contentType: string) {
    const key = `${beatSlug}/${name}`;
    await uploadR2Object({
      accountId: creds.accountId,
      bucketName: creds.bucketName,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      key,
      contentType,
      body: await file.arrayBuffer(),
    });
    return `${baseUrl}/${key}`;
  }

  if (files.preview) {
    results.preview = await uploadFile(files.preview, "preview.mp3", "audio/mpeg");
  }

  if (files.mp3) {
    results.untaggedMp3 = await uploadFile(files.mp3, "untagged.mp3", "audio/mpeg");
  }

  if (files.stems) {
    results.fullVersionZip = await uploadFile(files.stems, "stems.zip", "application/zip");
  }

  if (files.coverArt) {
    const imageName = files.coverArt.name.toLowerCase().endsWith(".png") ? "cover.png" : "cover.jpg";
    const imageType = imageName.endsWith(".png") ? "image/png" : "image/jpeg";
    results.coverArt = await uploadFile(files.coverArt, imageName, imageType);
  }

  return results;
}

// Legacy function for backward compatibility
export async function uploadBeatFilesForShop(shop: string, files: BeatFileUpload, beatSlug: string) {
  const storageConfig = await getStorageConfig(shop);

  if (!storageConfig || storageConfig.status === "disconnected") {
    throw new Error("Storage is not configured. Go to Storage & Delivery first.");
  }

  if (storageConfig.mode === "self_managed") {
    return uploadSelfManagedR2Legacy(shop, files, beatSlug);
  }

  const dynamicFiles: DynamicFileUpload[] = [];
  if (files.preview) dynamicFiles.push({ file: files.preview, fileType: "mp3", originalName: files.preview.name });
  if (files.mp3) dynamicFiles.push({ file: files.mp3, fileType: "mp3", originalName: files.mp3.name });
  if (files.wav) dynamicFiles.push({ file: files.wav, fileType: "wav", originalName: files.wav.name });
  if (files.stems) dynamicFiles.push({ file: files.stems, fileType: "stems", originalName: files.stems.name });
  if (files.coverArt) dynamicFiles.push({ file: files.coverArt, fileType: "cover", originalName: files.coverArt.name });

  const uploaded = await uploadManagedR2(dynamicFiles, beatSlug);
  const result: UploadedBeatFiles = {};
  for (const item of uploaded) {
    if (!result.preview && item.fileType === "mp3") {
      result.preview = item.storageUrl;
      continue;
    }
    if (!result.untaggedMp3 && item.fileType === "mp3") {
      result.untaggedMp3 = item.storageUrl;
      continue;
    }
    if (!result.fullVersionZip && item.fileType === "stems") {
      result.fullVersionZip = item.storageUrl;
      continue;
    }
    if (!result.coverArt && item.fileType === "cover") {
      result.coverArt = item.storageUrl;
    }
  }
  return result;
}
