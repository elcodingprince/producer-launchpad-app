import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { downloadR2Object } from "~/services/r2.server";
import {
  getManagedR2Credentials,
  getResolvedR2Credentials,
  getStorageConfig,
} from "~/services/storageConfig.server";
import { authenticate } from "~/shopify.server";

const PREVIEW_CACHE_CONTROL = "private, no-store";

function normalizeShopifyResourceId(id: string | null | undefined) {
  if (!id) return "";
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function resolveMimeType(fileType: string, filename: string) {
  const normalizedType = fileType.toLowerCase();
  const normalizedName = filename.toLowerCase();

  if (normalizedType === "mp3" || normalizedName.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (normalizedType === "wav" || normalizedName.endsWith(".wav")) {
    return "audio/wav";
  }

  return "application/octet-stream";
}

function getObjectKeyFromUrl(storageUrl: string, bucketName: string) {
  const url = new URL(storageUrl);
  const path = url.pathname.replace(/^\/+/, "");
  const bucketPrefix = `${bucketName}/`;

  return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
}

function getStorageKey(
  file: { storageKey?: string | null; storageUrl: string },
  bucketName: string,
) {
  return file.storageKey?.trim() || getObjectKeyFromUrl(file.storageUrl, bucketName);
}

function copyIfPresent(headers: Headers, target: Headers, key: string) {
  const value = headers.get(key);
  if (value) target.set(key, value);
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const productId = normalizeShopifyResourceId(params.productId);

  if (!session?.shop) {
    return new Response("Preview session not found.", { status: 401 });
  }

  if (!productId) {
    return new Response("Preview request is missing a product ID.", { status: 400 });
  }

  const previewFile = await prisma.beatFile.findFirst({
    where: {
      shop: session.shop,
      filePurpose: "preview",
      OR: [
        { beatId: productId },
        { beatId: `gid://shopify/Product/${productId}` },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      filename: true,
      fileType: true,
      storageUrl: true,
      storageKey: true,
    },
  });

  if (!previewFile) {
    return new Response("Preview not found for this product.", { status: 404 });
  }

  const storageConfig = await getStorageConfig(session.shop);
  const creds =
    storageConfig?.mode === "self_managed"
      ? await getResolvedR2Credentials(session.shop)
      : getManagedR2Credentials();

  if (!creds) {
    return new Response("Preview storage is not configured.", { status: 500 });
  }

  try {
    const upstream = await downloadR2Object(
      {
        accountId: creds.accountId,
        bucketName: creds.bucketName,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        key: getStorageKey(previewFile, creds.bucketName),
      },
      {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        range: request.headers.get("Range"),
      },
    );

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") ||
        resolveMimeType(previewFile.fileType, previewFile.filename),
    );
    headers.set(
      "Content-Disposition",
      `inline; filename="${previewFile.filename.replace(/"/g, "")}"`,
    );
    headers.set("Cache-Control", PREVIEW_CACHE_CONTROL);
    headers.set(
      "Accept-Ranges",
      upstream.headers.get("accept-ranges") || "bytes",
    );

    copyIfPresent(upstream.headers, headers, "content-length");
    copyIfPresent(upstream.headers, headers, "content-range");
    copyIfPresent(upstream.headers, headers, "etag");
    copyIfPresent(upstream.headers, headers, "last-modified");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Failed to stream preview asset:", {
      shop: session.shop,
      productId,
      previewFileId: previewFile.id,
      error,
    });

    return new Response("We couldn't load this preview right now.", {
      status: 500,
    });
  }
};
