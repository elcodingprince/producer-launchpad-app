import type { LoaderFunctionArgs } from "@remix-run/node";
import { generateLicensePdf } from "~/services/pdf/generator.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Hardcoded mock data to test the React-PDF template and the Remix streaming response
  const mockLicenseData = {
    licenseName: "Premium Standard License",
    producerName: "Future Soundwaves",
    customerName: "John Doe",
    beatTitle: "Midnight Sky",
    date: new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
    orderNumber: "1055-TEST",
    streamLimit: 500000,
    copyLimit: 10000,
    termYears: 3,
    includesStems: false,
    term1: "The Licensee agrees that the instrumental must not be used in any defamatory, hateful, or derogatory material.",
    term2: "Upon expiration of the term, the Licensee must remove the song from audio streaming services unless a new license is purchased.",
  };

  try {
    const pdfStream = await generateLicensePdf(mockLicenseData);

    return new Response(pdfStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // 'inline' views it in the browser, 'attachment' forces a download.
        // Let's use attachment to fully test the "generating a file" experience.
        "Content-Disposition": 'attachment; filename="Premium_Standard_License_Midnight_Sky.pdf"',
      },
    });
  } catch (error) {
    console.error("Error generating test PDF:", error);
    return new Response("Failed to generate PDF document", { status: 500 });
  }
};
