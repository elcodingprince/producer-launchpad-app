import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { downloadR2Object } from "~/services/r2.server";
import {
  getManagedR2Credentials,
  getResolvedR2Credentials,
  getStorageConfig,
} from "~/services/storageConfig.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function resolveMimeType(fileType: string, filename: string) {
  const normalizedType = fileType.toLowerCase();
  const normalizedName = filename.toLowerCase();

  if (normalizedType === "mp3" || normalizedName.endsWith(".mp3")) return "audio/mpeg";
  if (normalizedType === "wav" || normalizedName.endsWith(".wav")) return "audio/wav";
  if (normalizedType === "stems" || normalizedName.endsWith(".zip")) return "application/zip";
  if (normalizedType === "cover" || normalizedName.endsWith(".png")) return "image/png";
  if (normalizedType === "cover" || normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function getObjectKeyFromUrl(storageUrl: string, bucketName: string) {
  const url = new URL(storageUrl);
  const path = url.pathname.replace(/^\/+/, "");
  const bucketPrefix = `${bucketName}/`;

  return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token, fileId } = params;

  if (!token || !fileId) {
    return new Response("This download request is not valid.", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { items: true },
  });

  if (!order) {
    return new Response("This download link is no longer valid.", { status: 403 });
  }

  const file = await prisma.beatFile.findUnique({
    where: { id: fileId },
    include: {
      licenseMappings: true,
    },
  });

  if (!file) {
    return new Response("This file is no longer available from this link.", { status: 404 });
  }

  const authorizedVariantIds = new Set(
    order.items.flatMap((item) => {
      const normalized = normalizeShopifyResourceId(item.variantId);
      return [item.variantId, normalized, `gid://shopify/ProductVariant/${normalized}`];
    })
  );
  const authorizedProductIds = new Set(order.items.map((item) => item.productId));
  const normalizedBeatId = file.beatId.match(/\/(\d+)$/)?.[1] || file.beatId;
  const hasMappedAccess = file.licenseMappings.some((mapping) => authorizedVariantIds.has(mapping.variantId));
  const hasPreviewAccess =
    file.filePurpose === "preview" && authorizedProductIds.has(normalizedBeatId);
  const hasAccess = hasMappedAccess || hasPreviewAccess;
  const matchedOrderItems = order.items.filter((item) => {
    const normalizedVariantId = normalizeShopifyResourceId(item.variantId);

    return file.licenseMappings.some((mapping) => {
      const normalizedMappingVariantId = normalizeShopifyResourceId(mapping.variantId);
      return normalizedMappingVariantId === normalizedVariantId;
    });
  });

  if (!hasAccess) {
    return new Response("This file is not available from this download link.", { status: 403 });
  }

  const storageConfig = await getStorageConfig(order.shop);
  const creds =
    storageConfig?.mode === "self_managed"
      ? await getResolvedR2Credentials(order.shop)
      : getManagedR2Credentials();

  if (!creds) {
    return new Response("We couldn't prepare this download right now. Please contact support.", { status: 500 });
  }

  const key = getObjectKeyFromUrl(file.storageUrl, creds.bucketName);

  try {
    const upstream = await downloadR2Object({
      accountId: creds.accountId,
      bucketName: creds.bucketName,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      key,
    });

    // Preview streaming should not count as delivered purchase-file access.
    if (file.filePurpose !== "preview" && matchedOrderItems.length > 0) {
      await prisma.orderItem.updateMany({
        where: {
          id: {
            in: matchedOrderItems.map((item) => item.id),
          },
        },
        data: {
          downloadCount: { increment: 1 },
        },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || resolveMimeType(file.fileType, file.filename),
        "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Failed to download file from R2:", error);
    return new Response(
      "We couldn't retrieve this file right now. Please try again in a moment or contact support.",
      { status: 500 },
    );
  }
};
