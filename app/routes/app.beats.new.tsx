import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import { Page, Layout, Banner } from "@shopify/polaris";
import { createMetafieldSetupService } from "../services/metafieldSetup";
import { createProductCreatorService } from "../services/productCreator";
import {
  createBunnyCdnService,
  ALLOWED_FILE_TYPES,
} from "../services/bunnyCdn";
import {
  beatUploadSchema,
  fileUploadSchema,
} from "../services/validation";
import { BeatUploadForm } from "../components/BeatUploadForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const productService = createProductCreatorService(session, admin);

  try {
    const setupStatus = await setupService.checkSetupStatus();

    // Redirect to setup if incomplete
    if (!setupStatus.isComplete) {
      return redirect("/app/setup");
    }

    // Load upload dependencies
    const [licenses, genres, producers] = await Promise.all([
      productService.getLicenseMetaobjects(),
      productService.getGenreMetaobjects(),
      productService.getProducerMetaobjects(),
    ]);

    return json({
      licenses,
      genres,
      producers,
      error: null,
    });
  } catch (error) {
    console.error("Upload page loader error:", error);
    return json(
      {
        licenses: [],
        genres: [],
        producers: [],
        error: error instanceof Error ? error.message : "Failed to load upload page",
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent") as string;

  if (intent === "upload") {
    try {
      const bunnyService = createBunnyCdnService();
      const productService = createProductCreatorService(session, admin);

      // Extract form data
      const title = formData.get("title") as string;
      const bpm = parseInt(formData.get("bpm") as string, 10);
      const key = formData.get("key") as string;
      const genreGid = formData.get("genre") as string;
      const producerGid = formData.get("producer") as string;
      const producerAlias = formData.get("producerAlias") as string;
      const licensePricesRaw = JSON.parse(
        (formData.get("licensePrices") as string) || "[]"
      );

      const licensePrices = Array.isArray(licensePricesRaw)
        ? licensePricesRaw.map((lp) => ({
            licenseId: lp.licenseId,
            licenseGid: lp.licenseGid,
            price: Number(lp.price),
          }))
        : [];

      // Get files from form data
      const previewFile = formData.get("previewFile") as File | null;
      const mp3File = formData.get("mp3File") as File | null;
      const stemsFile = formData.get("stemsFile") as File | null;
      const coverArtFile = formData.get("coverArtFile") as File | null;

      const payloadValidation = beatUploadSchema.safeParse({
        title,
        bpm,
        key,
        genreGid,
        producerGid,
        licensePrices,
      });

      if (!payloadValidation.success) {
        return json(
          {
            success: false,
            error: payloadValidation.error.issues
              .map((issue) => issue.message)
              .join(" "),
          },
          { status: 400 }
        );
      }

      const fileValidation = fileUploadSchema.safeParse({
        previewFile: previewFile ?? undefined,
        mp3File: mp3File ?? undefined,
        stemsFile: stemsFile ?? undefined,
        coverArtFile: coverArtFile ?? undefined,
      });

      if (!fileValidation.success) {
        return json(
          {
            success: false,
            error: fileValidation.error.issues
              .map((issue) => issue.message)
              .join(" "),
          },
          { status: 400 }
        );
      }

      const filesToValidate: Array<{ file: File; label: string }> = [];
      if (previewFile) filesToValidate.push({ file: previewFile, label: "Preview file" });
      if (mp3File) filesToValidate.push({ file: mp3File, label: "MP3 file" });
      if (stemsFile) filesToValidate.push({ file: stemsFile, label: "Stems file" });
      if (coverArtFile) filesToValidate.push({ file: coverArtFile, label: "Cover art" });

      for (const { file, label } of filesToValidate) {
        const validation = bunnyService.validateFile(file, ALLOWED_FILE_TYPES);
        if (!validation.valid) {
          return json(
            {
              success: false,
              error: `${label} error: ${validation.error}`,
            },
            { status: 400 }
          );
        }
      }

      const producers = await productService.getProducerMetaobjects();
      const producerName = producers.find((p) => p.id === producerGid)?.name;

      if (!producerName) {
        return json(
          { success: false, error: "Selected producer could not be found." },
          { status: 400 }
        );
      }

      // Generate beat slug
      const beatSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      // Upload files to BunnyCDN
      const uploadedFiles = await bunnyService.uploadBeatFiles(
        {
          preview: previewFile || undefined,
          mp3: mp3File || undefined,
          stems: stemsFile || undefined,
          coverArt: coverArtFile || undefined,
        },
        beatSlug
      );

      // Create product with variants
      const result = await productService.createBeatProduct({
        title,
        bpm,
        key,
        genreGid,
        producerGid,
        producerName,
        producerAlias: producerAlias || undefined,
        files: uploadedFiles,
        licenses: licensePrices,
      });

      // Redirect to beat list on success
      return redirect("/app/beats?success=true");
    } catch (error) {
      console.error("Upload error:", error);
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }

  return json({ success: false, error: "Unknown intent" }, { status: 400 });
};

export default function NewBeatPage() {
  const { licenses, genres, producers, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if (loaderError) {
    return (
      <Page title="Upload New Beat">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load upload page" status="critical">
              <p>{loaderError}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Upload New Beat"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner title="Upload failed" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BeatUploadForm
            licenses={licenses}
            genres={genres}
            producers={producers}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
