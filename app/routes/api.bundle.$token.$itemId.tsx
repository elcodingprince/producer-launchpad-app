import archiver from "archiver";
import type { BeatFile, LicenseFileMapping, OrderItem } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { PassThrough, Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
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

function getObjectKeyFromUrl(storageUrl: string, bucketName: string) {
  const url = new URL(storageUrl);
  const path = url.pathname.replace(/^\/+/, "");
  const bucketPrefix = `${bucketName}/`;

  return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
}

function isAudioDeliverable(file: BeatFile) {
  return !["preview", "license_pdf", "cover"].includes(file.filePurpose);
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildBundleFilename(item: OrderItem) {
  const beatTitle = slugifySegment(item.beatTitle) || "beat";
  const licenseName = slugifySegment(item.licenseName) || "license";
  return `${beatTitle}-${licenseName}-audio-package.zip`;
}

interface BundleSource {
  file: BeatFile;
  body: ReadableStream;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token, itemId } = params;

  if (!token || !itemId) {
    return new Response("This download request is not valid.", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { items: true },
  });

  if (!order) {
    return new Response("This download link is no longer valid.", { status: 403 });
  }

  const item = order.items.find((orderItem: OrderItem) => orderItem.id === itemId);

  if (!item) {
    return new Response("This audio package is not available from this download link.", { status: 404 });
  }

  const normalizedVariantId = normalizeShopifyResourceId(item.variantId);
  const fileMappings = await prisma.licenseFileMapping.findMany({
    where: {
      variantId: {
        in: [
          item.variantId,
          normalizedVariantId,
          `gid://shopify/ProductVariant/${normalizedVariantId}`,
        ],
      },
    },
    include: {
      beatFile: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  const audioFiles = fileMappings
    .map((mapping: LicenseFileMapping & { beatFile: BeatFile }) => mapping.beatFile)
    .filter((file: BeatFile) => isAudioDeliverable(file));

  if (audioFiles.length === 0) {
    return new Response("This license does not have any audio files ready for download.", { status: 404 });
  }

  if (audioFiles.length === 1) {
    return Response.redirect(`/api/files/${token}/${audioFiles[0].id}`, 302);
  }

  const storageConfig = await getStorageConfig(order.shop);
  const creds =
    storageConfig?.mode === "self_managed"
      ? await getResolvedR2Credentials(order.shop)
      : getManagedR2Credentials();

  if (!creds) {
    return new Response("We couldn't prepare this audio package right now. Please contact support.", { status: 500 });
  }

  const sources: BundleSource[] = [];

  try {
    for (const file of audioFiles) {
      const key = getObjectKeyFromUrl(file.storageUrl, creds.bucketName);
      const upstream = await downloadR2Object({
        accountId: creds.accountId,
        bucketName: creds.bucketName,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        key,
      });

      if (!upstream.body) {
        throw new Error(`No response body returned for ${file.filename}`);
      }

      sources.push({
        file,
        body: upstream.body as ReadableStream,
      });
    }
  } catch (error) {
    console.error("Failed to prepare bundled audio package:", error);
    return new Response(
      "We couldn't prepare this audio package right now. Please try again in a moment or contact support.",
      { status: 500 },
    );
  }

  const archive = archiver("zip", {
    zlib: { level: 9 },
  });
  const output = new PassThrough();

  archive.on("error", (error) => {
    console.error("Failed to build audio package:", error);
    output.destroy(error);
  });

  archive.pipe(output);

  void (async () => {
    try {
      for (const source of sources) {
        archive.append(Readable.fromWeb(source.body), {
          name: source.file.filename,
        });
      }

      await archive.finalize();

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          downloadCount: { increment: 1 },
        },
      });
    } catch (error) {
      console.error("Failed to stream bundled audio package:", error);
      output.destroy(error instanceof Error ? error : new Error("Failed to stream bundle"));
    }
  })();

  return new Response(Readable.toWeb(output) as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${buildBundleFilename(item)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
};
