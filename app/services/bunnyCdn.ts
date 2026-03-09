export interface BunnyUploadResult {
  url: string;
  path: string;
  fileName: string;
}

export interface BeatFileUpload {
  preview?: File;
  mp3?: File;
  wav?: File;
  stems?: File;
  coverArt?: File;
}

export interface UploadedBeatFiles {
  preview?: string;
  untaggedMp3?: string;
  fullVersionZip?: string;
  coverArt?: string;
}

export class BunnyCdnService {
  private storageZone: string;
  private storagePassword: string;
  private pullZone: string;
  private region: string;
  private baseUrl: string;

  constructor() {
    this.storageZone = process.env.BUNNY_STORAGE_ZONE || "";
    this.storagePassword = process.env.BUNNY_STORAGE_PASSWORD || "";
    this.pullZone = process.env.BUNNY_PULL_ZONE || "";
    this.region = process.env.BUNNY_REGION || "ny";
    this.baseUrl = `https://${this.region}.storage.bunnycdn.com`;

    if (!this.storageZone || !this.storagePassword || !this.pullZone) {
      throw new Error(
        "BunnyCDN configuration missing. Please set BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, and BUNNY_PULL_ZONE environment variables."
      );
    }
  }

  async uploadFile(
    file: Buffer | ArrayBuffer,
    fileName: string,
    contentType: string,
    folder?: string
  ): Promise<BunnyUploadResult> {
    const path = folder ? `/${folder}/${fileName}` : `/${fileName}`;
    const maxRetries = 2;
    const timeoutMs = 30000;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/${this.storageZone}${path}`, {
          method: "PUT",
          headers: {
            AccessKey: this.storagePassword,
            "Content-Type": contentType,
          },
          body: file,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `BunnyCDN upload failed: ${response.status} ${response.statusText}`
          );
        }

        clearTimeout(timeout);
        return {
          url: `https://${this.pullZone}.b-cdn.net${path}`,
          path,
          fileName,
        };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    if (lastError instanceof Error && lastError.name === "AbortError") {
      throw new Error(`BunnyCDN upload timed out for ${fileName}`);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`BunnyCDN upload failed for ${fileName}`);
  }

  async uploadBeatFiles(
    files: BeatFileUpload,
    beatSlug: string
  ): Promise<UploadedBeatFiles> {
    const results: UploadedBeatFiles = {};

    if (files.preview) {
      const arrayBuffer = await files.preview.arrayBuffer();
      const upload = await this.uploadFile(
        arrayBuffer,
        "preview.mp3",
        "audio/mpeg",
        beatSlug
      );
      results.preview = upload.url;
    }

    if (files.mp3) {
      const arrayBuffer = await files.mp3.arrayBuffer();
      const upload = await this.uploadFile(
        arrayBuffer,
        "untagged.mp3",
        "audio/mpeg",
        beatSlug
      );
      results.untaggedMp3 = upload.url;
    }

    if (files.stems) {
      const arrayBuffer = await files.stems.arrayBuffer();
      const upload = await this.uploadFile(
        arrayBuffer,
        "stems.zip",
        "application/zip",
        beatSlug
      );
      results.fullVersionZip = upload.url;
    }

    if (files.coverArt) {
      const arrayBuffer = await files.coverArt.arrayBuffer();
      const fileName = files.coverArt.name.toLowerCase().endsWith(".png")
        ? "cover.png"
        : "cover.jpg";
      const contentType = fileName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";
      const upload = await this.uploadFile(
        arrayBuffer,
        fileName,
        contentType,
        beatSlug
      );
      results.coverArt = upload.url;
    }

    return results;
  }

  async deleteFile(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${this.storageZone}${path}`, {
      method: "DELETE",
      headers: {
        AccessKey: this.storagePassword,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `BunnyCDN delete failed: ${response.status} ${response.statusText}`
      );
    }
  }

  validateFile(
    file: File,
    allowedTypes: Record<
      string,
      { ext: string; maxSize: number }
    >
  ): { valid: boolean; error?: string } {
    return validateUploadFile(file, allowedTypes);
  }
}

export const ALLOWED_FILE_TYPES = {
  "audio/mpeg": { ext: ".mp3", maxSize: 100 * 1024 * 1024 }, // 100MB
  "audio/wav": { ext: ".wav", maxSize: 500 * 1024 * 1024 }, // 500MB
  "audio/x-wav": { ext: ".wav", maxSize: 500 * 1024 * 1024 }, // 500MB
  "application/zip": { ext: ".zip", maxSize: 500 * 1024 * 1024 }, // 500MB
  "image/jpeg": { ext: ".jpg", maxSize: 10 * 1024 * 1024 }, // 10MB
  "image/png": { ext: ".png", maxSize: 10 * 1024 * 1024 }, // 10MB
};

export function createBunnyCdnService() {
  return new BunnyCdnService();
}

export function validateUploadFile(
  file: File,
  allowedTypes: Record<string, { ext: string; maxSize: number }>
): { valid: boolean; error?: string } {
  const config = allowedTypes[file.type];

  if (!config) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed.`,
    };
  }

  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${config.maxSize / 1024 / 1024}MB.`,
    };
  }

  return { valid: true };
}
