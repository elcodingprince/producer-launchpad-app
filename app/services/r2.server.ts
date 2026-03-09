import crypto from "crypto";

export type StorageErrorType = "auth" | "network" | "bucket" | "permission" | "unknown";

export interface R2ConnectionInput {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface R2ConnectionResult {
  ok: boolean;
  error?: string;
  errorType?: StorageErrorType;
}

export interface R2UploadInput {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  key: string;
  contentType: string;
  body: ArrayBuffer;
}

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function buildSigningKey(secretAccessKey: string, date: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function createSignedHeaders(input: {
  method: "PUT" | "DELETE";
  host: string;
  canonicalUri: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `host:${input.host}\nx-amz-content-sha256:${input.payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = buildSigningKey(input.secretAccessKey, dateStamp);
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": input.payloadHash,
  };
}

function classifyR2Error(error: unknown): { message: string; type: StorageErrorType } {
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Connection timed out", type: "network" };
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.includes("401") || message.includes("403") || message.includes("Signature")) {
    return { message, type: "auth" };
  }

  if (message.includes("404") || message.includes("NoSuchBucket")) {
    return { message, type: "bucket" };
  }

  if (message.includes("network") || message.includes("ENOTFOUND") || message.includes("ECONN")) {
    return { message, type: "network" };
  }

  if (message.includes("AccessDenied") || message.includes("permission")) {
    return { message, type: "permission" };
  }

  return { message, type: "unknown" };
}

async function signedR2Request(params: {
  method: "PUT" | "DELETE";
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  key: string;
  payload: string;
}) {
  const host = `${params.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${params.bucketName}/${params.key}`;
  const url = `https://${host}${canonicalUri}`;

  const headers = createSignedHeaders({
    method: params.method,
    host,
    canonicalUri,
    accessKeyId: params.accessKeyId,
    secretAccessKey: params.secretAccessKey,
    payloadHash: sha256Hex(params.payload),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: params.method,
      headers,
      body: params.method === "PUT" ? params.payload : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`R2 ${params.method} failed: ${response.status} ${response.statusText} ${responseText}`.trim());
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadR2Object(input: R2UploadInput) {
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${input.bucketName}/${input.key}`;
  const url = `https://${host}${canonicalUri}`;
  const payloadHash = crypto.createHash("sha256").update(Buffer.from(input.body)).digest("hex");

  const headers = {
    ...createSignedHeaders({
      method: "PUT",
      host,
      canonicalUri,
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
      payloadHash,
    }),
    "Content-Type": input.contentType,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: input.body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`R2 PUT failed: ${response.status} ${response.statusText} ${responseText}`.trim());
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function testR2Connection(input: R2ConnectionInput): Promise<R2ConnectionResult> {
  const accountId = input.accountId.trim();
  const bucketName = input.bucketName.trim();
  const accessKeyId = input.accessKeyId.trim();
  const secretAccessKey = input.secretAccessKey.trim();

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      error: "All R2 fields are required",
      errorType: "unknown",
    };
  }

  const healthcheckKey = `_pl-healthcheck/${Date.now()}.txt`;

  try {
    await signedR2Request({
      method: "PUT",
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
      key: healthcheckKey,
      payload: "producer-launchpad-healthcheck",
    });

    await signedR2Request({
      method: "DELETE",
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
      key: healthcheckKey,
      payload: "",
    });

    return { ok: true };
  } catch (error) {
    const parsed = classifyR2Error(error);
    return {
      ok: false,
      error: parsed.message,
      errorType: parsed.type,
    };
  }
}
