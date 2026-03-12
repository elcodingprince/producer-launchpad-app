import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/db.server";
import { generateLicensePdf } from "~/services/pdf/generator.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { token, itemId } = params;

  if (!token || !itemId) {
    return new Response("Invalid request", { status: 400 });
  }

  // Very strict security check: ensure the item actually belongs to the token
  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: {
      items: {
        where: { id: itemId }
      }
    }
  });

  if (!order || order.items.length === 0) {
    return new Response("Unauthorized", { status: 403 });
  }

  const item = order.items[0];

  // We need to fetch the actual license metaobject rules from Shopify
  // But for the portal demo, we will use default mock rules similar to the test-pdf until we wire up the Admin GraphQL call
  
  const licenseData = {
    licenseName: item.licenseName,
    producerName: "Future Soundwaves", // In production we get this from the app config or metafield
    customerName: order.customerName || order.customerEmail,
    beatTitle: item.beatTitle,
    date: new Date(order.createdAt).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
    orderNumber: order.orderNumber,
    streamLimit: item.licenseName.toLowerCase().includes('unlimited') ? 0 : 500000,
    copyLimit: item.licenseName.toLowerCase().includes('unlimited') ? 0 : 10000,
    termYears: item.licenseName.toLowerCase().includes('unlimited') ? 0 : 3,
    includesStems: item.licenseName.toLowerCase().includes('unlimited') ? true : false,
    term1: "The Licensee agrees that the instrumental must not be used in any defamatory, hateful, or derogatory material.",
    term2: "Upon expiration of the term, the Licensee must remove the song from audio streaming services unless a new license is purchased.",
  };

  try {
    const pdfStream = await generateLicensePdf(licenseData);

    const safeFileName = `${item.licenseName.replace(/[^a-z0-9]/gi, '_')}_${item.beatTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`;

    // Increment download counter logging
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { downloadCount: { increment: 1 } }
    });

    return new Response(pdfStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate real license PDF:", error);
    return new Response("Failed to generate PDF document", { status: 500 });
  }
};
