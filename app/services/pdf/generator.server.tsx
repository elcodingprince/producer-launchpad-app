import { renderToStream } from "@react-pdf/renderer";
import { BasicLicenseTemplate } from "./templates/BasicLicense";

export interface LicenseData {
  licenseName: string;
  producerName: string;
  customerName: string;
  beatTitle: string;
  date: string;
  orderNumber: string;
  streamLimit: number;
  copyLimit: number;
  termYears: number;
  includesStems: boolean;
  term1?: string;
  term2?: string;
}

export async function generateLicensePdf(data: LicenseData): Promise<ReadableStream> {
  const stream = await renderToStream(
    // @ts-ignore - The types from react-pdf/renderer can sometimes be tricky in server environments, but the runtime works perfectly
    <BasicLicenseTemplate {...data} />
  );
  
  // Convert Node.js Readable stream an to Edge-compatible Web ReadableStream
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      stream.on('end', () => {
        controller.close();
      });
      stream.on('error', (err) => {
        controller.error(err);
      });
    }
  });
}
