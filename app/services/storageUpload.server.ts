import { createBunnyCdnService, type BeatFileUpload, type UploadedBeatFiles } from "./bunnyCdn";
import { getResolvedR2Credentials, getStorageConfig } from "./storageConfig.server";
import { uploadR2Object } from "./r2.server";

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function uploadSelfManagedR2(shop: string, files: BeatFileUpload, beatSlug: string): Promise<UploadedBeatFiles> {
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

export async function uploadBeatFilesForShop(shop: string, files: BeatFileUpload, beatSlug: string) {
  const storageConfig = await getStorageConfig(shop);

  if (!storageConfig || storageConfig.status === "disconnected") {
    throw new Error("Storage is not configured. Go to Storage & Delivery first.");
  }

  if (storageConfig.mode === "self_managed") {
    return uploadSelfManagedR2(shop, files, beatSlug);
  }

  const managedUploader = createBunnyCdnService();
  return managedUploader.uploadBeatFiles(files, beatSlug);
}
