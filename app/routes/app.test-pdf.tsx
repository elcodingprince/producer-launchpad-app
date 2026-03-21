import type { LoaderFunctionArgs } from "@remix-run/node";
import { renderAgreementPreview } from "~/services/licenses/agreementRenderer.server";
import { generatePdfFromHtml } from "~/services/pdf/htmlToPdf.server";

export const loader = async (_args: LoaderFunctionArgs) => {
  const mockAgreement = await renderAgreementPreview({
    mode: "resolved",
    license: {
      handle: "premium-license",
      licenseName: "Premium Standard License",
      legalTemplateFamily: "premium",
      streamLimit: "500000",
      copyLimit: "10000",
      videoViewLimit: "1000000",
      termYears: "3",
      fileFormats: "MP3, WAV",
      stemsPolicy: "available_as_addon",
      contentIdPolicy: "allowed_for_new_song_only",
      syncPolicy: "limited_sync_with_approval",
      creditRequirement: "required",
      publishingSplitMode: "fixed_split",
      publishingSplitSummary: "50% Licensor / 50% Licensee",
      terms: [
        "The Licensee agrees that the instrumental must not be used in any defamatory, hateful, or derogatory material.",
        "Upon expiration of the term, the Licensee must remove the song from audio streaming services unless a new license is purchased.",
      ],
    },
    licensor: {
      legalName: "Future Soundwaves LLC",
      dbaName: "Future Soundwaves",
      noticeEmail: "legal@futuresoundwaves.com",
      governingLawRegion: "California, USA",
      disputeForum:
        "State or federal courts located in Los Angeles County, California, USA",
      signatureLabel: "Manager",
      signatureImageUrl: "",
    },
    context: {
      producerAliases: "Future Soundwaves",
      customerName: "John Doe",
      customerEmail: "john@example.com",
      purchaseDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      beatTitle: "Midnight Sky",
      licensePrice: "$79.00",
      orderId: "1055-TEST",
      templateVersion: "test-premium-v1",
      buyerIp: "198.51.100.42",
      userAgent: "Agreement PDF test route",
      stemsIncludedInOrder: false,
    },
  });

  try {
    const pdfBuffer = await generatePdfFromHtml(mockAgreement.html);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Disposition":
          'attachment; filename="Premium_Standard_License_Midnight_Sky.pdf"',
      },
    });
  } catch (error) {
    console.error("Error generating HTML-based test PDF:", error);
    return new Response("Failed to generate PDF document", { status: 500 });
  }
};
