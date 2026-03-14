import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { isRouteErrorResponse, useLoaderData, useRouteError } from "@remix-run/react";
import type { BeatFile, LicenseFileMapping, OrderItem } from "@prisma/client";
import prisma from "~/db.server";

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { token } = params;

  if (!token) {
    throw new Response("Download token missing", { status: 404 });
  }

  // Find the exact order by the token securely attached to it
  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new Response("Order not found or link has expired", { status: 404 });
  }

  if (order.items.length === 0) {
    return json({
      order,
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
          sortOrder: 'asc'
        }
      });

      // Also get the preview file if available to play right on the portal
      const previewFile = await prisma.beatFile.findFirst({
        where: {
          beatId: `gid://shopify/Product/${item.productId}`,
          filePurpose: 'preview'
        }
      });

      return {
        ...item,
        previewFileId: previewFile?.id || null,
        previewUrl: previewFile?.storageUrl || null,
        files: fileMappings.map((mapping: LicenseFileMapping & { beatFile: BeatFile }): BeatFile => mapping.beatFile),
        deliveryStatus: fileMappings.length > 0 ? "ready" : "missing_files",
      };
    })
  );

  const readyItemCount = enrichedItems.filter((item) => item.deliveryStatus === "ready").length;

  let portalStatus: "ready" | "partial" | "missing_files" | "no_downloadable_items" = "ready";

  if (readyItemCount === 0) {
    portalStatus = "missing_files";
  } else if (readyItemCount < enrichedItems.length) {
    portalStatus = "partial";
  }

  return json({ order, items: enrichedItems, portalStatus });
};

export default function DownloadPortalPage() {
  const { order, items, portalStatus } = useLoaderData<typeof loader>();

  const portalNotice =
    portalStatus === "partial"
      ? {
          title: "Some files are ready",
          body: "You can download the files that are available now. If anything is missing, please contact support and share your order number.",
          background: "#fff7ed",
          border: "#fdba74",
          text: "#9a3412",
        }
      : portalStatus === "missing_files" || portalStatus === "no_downloadable_items"
        ? {
            title: "We found your order, but your files are not available yet",
            body: "Your order was received, but we could not prepare the downloadable files from this link. Please contact support and share your order number.",
            background: "#fef2f2",
            border: "#fca5a5",
            text: "#991b1b",
          }
        : null;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        
        {/* Header Block */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Thanks for your order, {order.customerName || 'Producer'}!
          </h1>
          <p style={{ color: '#4b5563', fontSize: '16px' }}>
            Order #{order.orderNumber} • {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>

        {portalNotice && (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${portalNotice.border}`,
              backgroundColor: portalNotice.background,
            }}
          >
            <h2 style={{ margin: 0, marginBottom: '8px', fontSize: '16px', fontWeight: 600, color: portalNotice.text }}>
              {portalNotice.title}
            </h2>
            <p style={{ margin: 0, color: portalNotice.text, lineHeight: 1.5 }}>
              {portalNotice.body}
            </p>
          </div>
        )}

        {/* Beats Block */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
            Your Downloads
          </h2>

          {items.map((item) => (
            <div key={item.id} style={{ 
              marginBottom: '24px', 
              padding: '16px', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px',
              backgroundColor: '#f8fafc'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>{item.beatTitle}</h3>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{item.licenseName}</p>
                </div>
                {item.previewFileId && (
                  <audio
                    controls
                    src={`/api/files/${order.downloadToken}/${item.previewFileId}`}
                    style={{ height: '36px' }}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                
                {/* Dynamically Generated PDF Contract Button */}
                <a 
                  href={`/api/pdf/${order.downloadToken}/${item.id}`} // We will build this handler next
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    backgroundColor: '#111827',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  📄 License Agreement (PDF)
                </a>

                {/* The Actual Beat Audio Files */}
                {item.files.map((file: BeatFile) => (
                  <a
                    key={file.id}
                    href={`/api/files/${order.downloadToken}/${file.id}`}
                    style={{
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    🎵 Download {file.fileType.toUpperCase().replace('AUDIO/', '')}
                  </a>
                ))}

                {item.deliveryStatus === "missing_files" && (
                  <p style={{ margin: 0, color: '#991b1b', fontSize: '14px' }}>
                    Download files are not available for this license yet. Please contact support.
                  </p>
                )}

              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>
              No beats found for this order. Please contact support.
            </p>
          )}

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#9ca3af', fontSize: '14px' }}>
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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: '12px', fontSize: '28px', color: '#111827' }}>
          {title}
        </h1>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
    </div>
  );
}
