import { json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import type { BeatFile, LicenseFileMapping, OrderItem } from "@prisma/client";
import prisma from "~/db.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function isAudioDeliverable(file: BeatFile) {
  return !["preview", "license_pdf", "cover"].includes(file.filePurpose);
}

function isBaseAudioDeliverable(file: BeatFile) {
  return isAudioDeliverable(file) && file.filePurpose !== "stems";
}

function getFileLabel(file: BeatFile) {
  if (file.filePurpose === "stems") return "STEMS";
  if (file.filePurpose === "wav") return "WAV";
  if (file.filePurpose === "mp3") return "MP3";

  return file.fileType.toUpperCase().replace("AUDIO/", "");
}

function mergeUniqueFiles(files: BeatFile[]) {
  const seen = new Set<string>();
  const ordered: BeatFile[] = [];

  for (const file of files) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    ordered.push(file);
  }

  return ordered;
}

function getDeliveryPackageSummary(files: BeatFile[]) {
  return files.map((file) => getFileLabel(file)).join(", ");
}

function renderFormatChipStyles(tone: "base" | "accent") {
  if (tone === "accent") {
    return {
      backgroundColor: "#dcfce7",
      color: "#166534",
      border: "1px solid #86efac",
    };
  }

  return {
    backgroundColor: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
  };
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token } = params;

  if (!token) {
    throw new Response("Download token missing", { status: 404 });
  }

  // Find the exact order by the token securely attached to it
  const deliveryAccess = await prisma.deliveryAccess.findUnique({
    where: { downloadToken: token },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!deliveryAccess) {
    throw new Response("Order not found or link has expired", { status: 404 });
  }

  const { order } = deliveryAccess;

  if (order.items.length === 0) {
    return json({
      order,
      deliveryAccess,
      items: [],
      portalStatus: "no_downloadable_items" as const,
    });
  }

  // To build the portal we will also need the actual beat files from Prisma
  // For each OrderItem, we'll fetch its associated beat to grab the `id` from Shopify
  // Then we can find exactly which files map to the purchased license tier.

  const enrichedItems = await Promise.all(
    order.items.map(async (item: OrderItem) => {
      const normalizedVariantId = normalizeShopifyResourceId(item.variantId);

      // Resolve files directly from the purchased Shopify variant ID.
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
      const stemsFile = item.stemsIncludedInOrder
        ? await prisma.beatFile.findFirst({
            where: {
              beatId: `gid://shopify/Product/${item.productId}`,
              filePurpose: "stems",
            },
          })
        : null;

      // Also get the preview file if available to play right on the portal
      const previewFile = await prisma.beatFile.findFirst({
        where: {
          beatId: `gid://shopify/Product/${item.productId}`,
          filePurpose: "preview",
        },
      });
      const baseAudioFiles = fileMappings
        .map(
          (mapping: LicenseFileMapping & { beatFile: BeatFile }): BeatFile =>
            mapping.beatFile,
        )
        .filter((file: BeatFile) => isBaseAudioDeliverable(file));
      const stemsRequirementMissing =
        item.stemsIncludedInOrder && !Boolean(stemsFile);

      return {
        ...item,
        previewFileId: previewFile?.id || null,
        previewUrl: previewFile?.storageUrl || null,
        files: mergeUniqueFiles([
          ...baseAudioFiles,
          ...(stemsFile ? [stemsFile] : []),
        ]),
        deliveryStatus:
          baseAudioFiles.length > 0 && !stemsRequirementMissing
            ? "ready"
            : "missing_files",
      };
    }),
  );

  const readyItemCount = enrichedItems.filter(
    (item) => item.deliveryStatus === "ready",
  ).length;

  let portalStatus:
    | "ready"
    | "partial"
    | "missing_files"
    | "no_downloadable_items" = "ready";

  if (readyItemCount === 0) {
    portalStatus = "missing_files";
  } else if (readyItemCount < enrichedItems.length) {
    portalStatus = "partial";
  }

  return json({ order, deliveryAccess, items: enrichedItems, portalStatus });
};

export default function DownloadPortalPage() {
  const { order, deliveryAccess, items, portalStatus } =
    useLoaderData<typeof loader>();

  const portalNotice =
    portalStatus === "partial"
      ? {
          title: "Some files are ready",
          body: "You can download the files that are available now. If anything is missing, please contact support and share your order number.",
          background: "#fff7ed",
          border: "#fdba74",
          text: "#9a3412",
        }
      : portalStatus === "missing_files" ||
          portalStatus === "no_downloadable_items"
        ? {
            title: "We found your order, but your files are not available yet",
            body: "Your order was received, but we could not prepare the downloadable files from this link. Please contact support and share your order number.",
            background: "#fef2f2",
            border: "#fca5a5",
            text: "#991b1b",
          }
        : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}
      >
        {/* Header Block */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "#111827",
              marginBottom: "8px",
            }}
          >
            Thanks for your order, {deliveryAccess.customerName || "Producer"}!
          </h1>
          <p style={{ color: "#4b5563", fontSize: "16px" }}>
            Order #{order.orderNumber} •{" "}
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>

        {portalNotice && (
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${portalNotice.border}`,
              backgroundColor: portalNotice.background,
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "16px",
                fontWeight: 600,
                color: portalNotice.text,
              }}
            >
              {portalNotice.title}
            </h2>
            <p style={{ margin: 0, color: portalNotice.text, lineHeight: 1.5 }}>
              {portalNotice.body}
            </p>
          </div>
        )}

        {/* Beats Block */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginBottom: "24px",
              color: "#374151",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "12px",
            }}
          >
            Your Downloads
          </h2>

          {items.map((item) => (
            <div
              key={item.id}
              style={{
                marginBottom: "24px",
                padding: "22px",
                border: "1px solid #dbe4ee",
                borderRadius: "18px",
                background:
                  "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
              }}
            >
              {(() => {
                const audioFiles = item.files.filter((file: BeatFile) =>
                  isAudioDeliverable(file),
                );
                const hasBundle = audioFiles.length > 1;
                const singleAudioFile =
                  audioFiles.length === 1 ? audioFiles[0] : null;
                const packageSummary = getDeliveryPackageSummary(audioFiles);

                return (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        marginBottom: "18px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontSize: "30px",
                            lineHeight: "34px",
                            fontWeight: "700",
                            color: "#1f2937",
                            margin: 0,
                          }}
                        >
                          {item.beatTitle}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            marginTop: "12px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: "999px",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              backgroundColor: "#e5e7eb",
                              color: "#111827",
                            }}
                          >
                            {item.licenseName}
                          </span>
                          {item.stemsIncludedInOrder ? (
                            <span
                              style={{
                                display: "inline-block",
                                borderRadius: "999px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                              }}
                            >
                              STEMS included
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {item.previewFileId && (
                        <div
                          style={{
                            minWidth: "320px",
                            flex: "1 1 320px",
                            maxWidth: "440px",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#64748b",
                            }}
                          >
                            Preview
                          </p>
                          <audio
                            controls
                            src={`/api/files/${deliveryAccess.downloadToken}/${item.previewFileId}`}
                            style={{ height: "40px", width: "100%" }}
                          />
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        marginBottom: "16px",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 10px",
                          fontSize: "12px",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        Delivery package
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginBottom: "10px",
                        }}
                      >
                        {audioFiles.map((file: BeatFile) => {
                          const label = getFileLabel(file);
                          const tone = label === "STEMS" ? "accent" : "base";

                          return (
                            <span
                              key={`${item.id}-${file.id}`}
                              style={{
                                display: "inline-block",
                                borderRadius: "999px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                ...renderFormatChipStyles(tone),
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          color: "#475569",
                          fontSize: "14px",
                          lineHeight: 1.6,
                        }}
                      >
                        {item.stemsIncludedInOrder
                          ? "This order includes stems access for this license, so your ZIP contains the full package shown above."
                          : "Your ZIP contains the package shown above for this license."}
                      </p>
                    </div>

                    <div
                      style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
                    >
                      <a
                        href={`/api/pdf/${deliveryAccess.downloadToken}/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          backgroundColor: "#111827",
                          color: "white",
                          padding: "10px 16px",
                          borderRadius: "10px",
                          textDecoration: "none",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                      >
                        View license agreement
                      </a>

                      {hasBundle && (
                        <a
                          href={`/api/bundle/${deliveryAccess.downloadToken}/${item.id}`}
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0f172a",
                            padding: "10px 16px",
                            borderRadius: "10px",
                            textDecoration: "none",
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          Download audio package
                        </a>
                      )}

                      {!hasBundle && singleAudioFile && (
                        <a
                          href={`/api/files/${deliveryAccess.downloadToken}/${singleAudioFile.id}`}
                          style={{
                            backgroundColor: "#e0f2fe",
                            color: "#0f172a",
                            padding: "10px 16px",
                            borderRadius: "10px",
                            textDecoration: "none",
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          Download {getFileLabel(singleAudioFile)}
                        </a>
                      )}

                      {item.deliveryStatus === "missing_files" && (
                        <p
                          style={{
                            margin: 0,
                            color: "#991b1b",
                            fontSize: "14px",
                          }}
                        >
                          Download files are not available for this license yet.
                          Please contact support.
                        </p>
                      )}
                    </div>

                    {hasBundle ? (
                      <p
                        style={{
                          margin: "14px 0 0",
                          color: "#64748b",
                          fontSize: "13px",
                        }}
                      >
                        One-click ZIP package: {packageSummary}
                      </p>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ))}

          {items.length === 0 && (
            <p
              style={{
                color: "#6b7280",
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              No beats found for this order. Please contact support.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "40px",
            color: "#9ca3af",
            fontSize: "14px",
          }}
        >
          <p>This is a secure page. Keep this link completely private.</p>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let title = "We couldn't open this download page";
  let body =
    "Something unexpected happened while preparing your downloads. Please try again in a moment or contact support and share your order details.";

  if (isRouteErrorResponse(error) && error.status === 404) {
    title = "This download link is no longer valid";
    body =
      "This link may have expired or been replaced. Please contact support for a new access link.";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "640px",
          width: "100%",
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "32px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "12px",
            fontSize: "28px",
            color: "#111827",
          }}
        >
          {title}
        </h1>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}
