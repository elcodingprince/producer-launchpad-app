import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import prisma from "~/db.server";

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

  // To build the portal we will also need the actual beat files from Prisma
  // For each OrderItem, we'll fetch its associated beat to grab the `id` from Shopify
  // Then we can find exactly which files map to the purchased license tier.
  
  const enrichedItems = await Promise.all(
    order.items.map(async (item) => {
      // Find the beat files in the database associated with this product
      // that mapped specifically to the license they just purchased.
      
      const fileMappings = await prisma.licenseFileMapping.findMany({
        where: {
          beatId: `gid://shopify/Product/${item.productId}`, // Make sure we match the GID format used in upload
          licenseTier: item.licenseName.toLowerCase().replace(/ license$/i, '').trim(), // Trying to map "Basic License" -> "basic" based on previous behavior
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
        previewUrl: previewFile?.storageUrl || null,
        files: fileMappings.map(m => m.beatFile)
      };
    })
  );

  return json({ order, items: enrichedItems });
};

export default function DownloadPortalPage() {
  const { order, items } = useLoaderData<typeof loader>();

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
                {item.previewUrl && (
                  <audio controls src={item.previewUrl} style={{ height: '36px' }} />
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
                {item.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.storageUrl}
                    download={file.filename}
                    target="_blank"
                    rel="noreferrer"
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
