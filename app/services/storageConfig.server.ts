import prisma from "~/db.server";
import { decrypt, encrypt } from "./crypto.server";
import type { StorageErrorType } from "./r2.server";

export type StorageMode = "managed" | "self_managed";
export type StorageStatus = "disconnected" | "connected" | "error";
export interface ResolvedR2Credentials {
  accountId: string;
  bucketName: string;
  publicBaseUrl: string | null;
  accessKeyId: string;
  secretAccessKey: string;
}

interface SaveSelfManagedInput {
  shop: string;
  accountId: string;
  bucketName: string;
  publicBaseUrl?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function maskKey(value: string) {
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function normalizeMode(mode: string | null | undefined): StorageMode | null {
  if (mode === "managed" || mode === "self_managed") return mode;
  return null;
}

function storageDelegate() {
  const delegate = (prisma as any).shopStorageConfig;
  if (!delegate) {
    throw new Error(
      "ShopStorageConfig model is unavailable in the running Prisma client. Restart the dev server after prisma generate/db push."
    );
  }
  return delegate;
}

export async function getStorageConfig(shop: string) {
  return storageDelegate().findUnique({ where: { shop } });
}

export async function getStorageConfigForDisplay(shop: string) {
  const config = await getStorageConfig(shop);
  if (!config) return null;

  let maskedAccessKeyId: string | null = null;
  if (config.accessKeyIdEnc) {
    try {
      maskedAccessKeyId = maskKey(decrypt(config.accessKeyIdEnc));
    } catch {
      maskedAccessKeyId = "****";
    }
  }

  return {
    ...config,
    maskedAccessKeyId,
  };
}

export async function setStorageMode(shop: string, mode: StorageMode) {
  const status: StorageStatus = mode === "managed" ? "connected" : "disconnected";

  return storageDelegate().upsert({
    where: { shop },
    create: {
      shop,
      mode,
      status,
      provider: mode === "self_managed" ? "r2" : null,
      lastError: null,
      errorType: null,
    },
    update: {
      mode,
      status,
      provider: mode === "self_managed" ? "r2" : null,
      lastError: null,
      errorType: null,
    },
  });
}

export async function saveSelfManagedConfig(input: SaveSelfManagedInput) {
  const normalizedPublicBaseUrl = (input.publicBaseUrl || "").trim();

  return storageDelegate().upsert({
    where: { shop: input.shop },
    create: {
      shop: input.shop,
      mode: "self_managed",
      provider: "r2",
      status: "connected",
      accountId: input.accountId,
      bucketName: input.bucketName,
      publicBaseUrl: normalizedPublicBaseUrl || null,
      accessKeyIdEnc: encrypt(input.accessKeyId),
      secretAccessKeyEnc: encrypt(input.secretAccessKey),
      lastTestedAt: new Date(),
      lastError: null,
      errorType: null,
    },
    update: {
      mode: "self_managed",
      provider: "r2",
      status: "connected",
      accountId: input.accountId,
      bucketName: input.bucketName,
      publicBaseUrl: normalizedPublicBaseUrl || null,
      accessKeyIdEnc: encrypt(input.accessKeyId),
      secretAccessKeyEnc: encrypt(input.secretAccessKey),
      lastTestedAt: new Date(),
      lastError: null,
      errorType: null,
    },
  });
}

export async function markStorageError(
  shop: string,
  errorMessage: string,
  errorType: StorageErrorType
) {
  return storageDelegate().upsert({
    where: { shop },
    create: {
      shop,
      mode: "self_managed",
      provider: "r2",
      status: "error",
      lastError: errorMessage,
      errorType,
      lastTestedAt: new Date(),
    },
    update: {
      status: "error",
      lastError: errorMessage,
      errorType,
      lastTestedAt: new Date(),
    },
  });
}

export async function getResolvedR2Credentials(shop: string) {
  const config = await getStorageConfig(shop);
  if (!config || config.mode !== "self_managed") {
    return null;
  }

  if (!config.accountId || !config.bucketName || !config.accessKeyIdEnc || !config.secretAccessKeyEnc) {
    return null;
  }

  try {
    return {
      accountId: config.accountId,
      bucketName: config.bucketName,
      publicBaseUrl: config.publicBaseUrl,
      accessKeyId: decrypt(config.accessKeyIdEnc),
      secretAccessKey: decrypt(config.secretAccessKeyEnc),
      status: config.status,
    };
  } catch {
    return null;
  }
}

export function getManagedR2Credentials(): ResolvedR2Credentials | null {
  const accountId = process.env.CF_R2_ACCOUNT_ID?.trim() || "";
  const bucketName = process.env.CF_R2_BUCKET_NAME?.trim() || "";
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY?.trim() || "";
  const publicBaseUrl = process.env.CF_R2_PUBLIC_BASE_URL?.trim() || null;

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function shouldHardBlockUpload(config: { status: string } | null) {
  return !config || config.status === "disconnected";
}

export function shouldSoftWarnUpload(config: { status: string } | null) {
  return !!config && config.status === "error";
}

export function parseStorageMode(mode: string | null | undefined) {
  return normalizeMode(mode);
}
