import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import {
  Page,
  Layout,
  Banner,
  Card,
  BlockStack,
  TextField,
  Select,
  ChoiceList,
  Button,
  Text,
  FormLayout,
} from "@shopify/polaris";
import { createMetafieldSetupService } from "../services/metafieldSetup";
import { createProductCreatorService } from "../services/productCreator";
import {
  getStorageConfigForDisplay,
  shouldHardBlockUpload,
  shouldSoftWarnUpload,
} from "~/services/storageConfig.server";
import { uploadBeatFilesForShop } from "~/services/storageUpload.server";
import {
  LicenseFileAssignment,
  type UploadedFile,
  type LicenseFiles,
} from "../components/LicenseFileAssignment";
import { UploadIcon } from "@shopify/polaris-icons";

const keyOptions = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "D# major", "D# minor",
  "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor",
  "G# major", "G# minor", "A major", "A minor",
  "A# major", "A# minor", "B major", "B minor",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const productService = createProductCreatorService(session, admin);

  try {
    const setupStatus = await setupService.checkSetupStatus();
    const storageConfig = await getStorageConfigForDisplay(session.shop);

    // Redirect to setup if incomplete
    if (!setupStatus.isComplete) {
      return redirect("/app/setup");
    }

    if (shouldHardBlockUpload(storageConfig)) {
      return redirect("/app/storage");
    }

    // Load upload dependencies
    const [licenses, genres, producers] = await Promise.all([
      productService.getLicenseMetaobjects(),
      productService.getGenreMetaobjects(),
      productService.getProducerMetaobjects(),
    ]);

    if (producers.length === 0) {
      return redirect("/app/setup");
    }

    return json({
      licenses,
      genres,
      producers,
      storageWarning: shouldSoftWarnUpload(storageConfig)
        ? storageConfig?.lastError || "Storage is currently in an error state."
        : null,
      error: null,
    });
  } catch (error) {
    console.error("Upload page loader error:", error);
    return json(
      {
        licenses: [],
        genres: [],
        producers: [],
        storageWarning: null,
        error: error instanceof Error ? error.message : "Failed to load upload page",
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const storageConfig = await getStorageConfigForDisplay(session.shop);

  const intent = formData.get("intent") as string;

  if (intent === "upload") {
    if (shouldHardBlockUpload(storageConfig)) {
      return redirect("/app/storage");
    }

    try {
      console.info("[upload] started");
      const productService = createProductCreatorService(session, admin);

      // Extract beat details
      const title = formData.get("title") as string;
      const bpm = parseInt(formData.get("bpm") as string, 10);
      const key = formData.get("key") as string;
      const genreGids = JSON.parse(formData.get("genreGids") as string || "[]");
      const producerGids = JSON.parse(formData.get("producerGids") as string || "[]");
      const producerAlias = formData.get("producerAlias") as string;

      // Extract license file assignments
      const licenseFilesData = JSON.parse(formData.get("licenseFiles") as string || "{}");
      const uploadedFilesData = JSON.parse(formData.get("uploadedFiles") as string || "[]");

      // Validate required fields
      if (!title || !bpm || !key || genreGids.length === 0 || producerGids.length === 0) {
        return json(
          { success: false, error: "Please fill in all required fields" },
          { status: 400 }
        );
      }

      // Validate license file assignments
      const licenseTiers = ["basic", "premium", "unlimited"];
      const missingAssignments = licenseTiers.filter(
        (tier) => !licenseFilesData[tier] || licenseFilesData[tier].length === 0
      );

      if (missingAssignments.length > 0) {
        return json(
          {
            success: false,
            error: `Please assign files to: ${missingAssignments.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const producers = await productService.getProducerMetaobjects();
      const selectedProducers = producers.filter((p) => producerGids.includes(p.id));
      const producerNames = selectedProducers.map((p) => p.name);

      // Generate beat slug
      const beatSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      // Upload files to storage
      console.info("[upload] uploading files to configured storage");
      
      // Create a map of fileId to storage URL
      const fileUrlMap = new Map<string, string>();
      
      for (const file of uploadedFilesData) {
        if (file.file && file.file instanceof File) {
          const uploaded = await uploadBeatFilesForShop(
            session.shop,
            { [file.type]: file.file },
            beatSlug
          );
          fileUrlMap.set(file.id, uploaded[file.type] || "");
        } else if (file.storageUrl) {
          fileUrlMap.set(file.id, file.storageUrl);
        }
      }

      // Prepare license prices from the data
      const licensePrices = [
        { licenseId: "basic", licenseGid: "", price: 29.99 },
        { licenseId: "premium", licenseGid: "", price: 49.99 },
        { licenseId: "unlimited", licenseGid: "", price: 99.99 },
      ];

      // Get actual license GIDs from the database
      const licenses = await productService.getLicenseMetaobjects();
      const licenseMap = new Map(licenses.map((l) => [l.licenseId, l.id]));

      // Create product with variants - each variant gets its files
      console.info("[upload] creating Shopify product");
      
      // Prepare files for each license tier
      const tierFiles: Record<string, string[]> = {};
      for (const tier of licenseTiers) {
        const fileIds = licenseFilesData[tier] || [];
        tierFiles[tier] = fileIds.map((id: string) => fileUrlMap.get(id) || "").filter(Boolean);
      }

      const result = await productService.createBeatProduct({
        title,
        bpm,
        key,
        genreGids,
        producerGids,
        producerNames,
        producerAlias: producerAlias || undefined,
        files: {
          preview: tierFiles.basic[0] || "",
          untaggedMp3: tierFiles.basic[0] || "",
          fullVersionZip: tierFiles.unlimited.find((f: string) => f.includes("zip")) || "",
          coverArt: "",
        },
        licenses: licensePrices.map((lp) => ({
          ...lp,
          licenseGid: licenseMap.get(lp.licenseId) || "",
        })),
      });

      // Save license file mappings to database
      // TODO: Add database call to save BeatFile and LicenseFileMapping records

      console.info("[upload] completed successfully", { productId: result.productId });
      return redirect("/app/beats?success=true");
    } catch (error) {
      console.error("Upload error:", error);
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }

  return json({ success: false, error: "Unknown intent" }, { status: 400 });
};

export default function NewBeatPage() {
  const { licenses, genres, producers, storageWarning, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  // Form state
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("C minor");
  const [genreGids, setGenreGids] = useState<string[]>(genres[0]?.id ? [genres[0].id] : []);
  const [producerGids, setProducerGids] = useState<string[]>(producers[0]?.id ? [producers[0].id] : []);
  const [producerAlias, setProducerAlias] = useState("");

  // License file assignment state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [licenseFiles, setLicenseFiles] = useState<LicenseFiles>({
    basic: [],
    premium: [],
    unlimited: [],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: File[]): Promise<UploadedFile[]> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Return files with temporary IDs - actual upload happens in action
      const uploadedFiles: UploadedFile[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: detectFileType(file.name),
        size: formatFileSize(file.size),
        file,
      }));

      return uploadedFiles;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Detect file type
  const detectFileType = (filename: string): UploadedFile["type"] => {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "mp3") return "mp3";
    if (ext === "wav") return "wav";
    if (ext === "zip") return "stems";
    if (["jpg", "jpeg", "png"].includes(ext || "")) return "cover";
    return "other";
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      title &&
      bpm &&
      key &&
      genreGids.length > 0 &&
      producerGids.length > 0 &&
      licenseFiles.basic.length > 0 &&
      licenseFiles.premium.length > 0 &&
      licenseFiles.unlimited.length > 0
    );
  };

  // Handle form submission
  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("intent", "upload");
    formData.append("title", title);
    formData.append("bpm", bpm);
    formData.append("key", key);
    formData.append("genreGids", JSON.stringify(genreGids));
    formData.append("producerGids", JSON.stringify(producerGids));
    formData.append("producerAlias", producerAlias);
    formData.append("licenseFiles", JSON.stringify(licenseFiles));
    formData.append("uploadedFiles", JSON.stringify(uploadedFiles));

    submit(formData, { method: "post" });
  };

  // Map licenses to tier format for LicenseFileAssignment
  const licenseTiers = [
    { id: "basic", name: "Basic", price: "$29.99", description: "MP3 for personal use" },
    { id: "premium", name: "Premium", price: "$49.99", description: "MP3 + WAV for commercial use" },
    { id: "unlimited", name: "Unlimited", price: "$99.99", description: "Full package + stems" },
  ];

  const genreOptions = genres.map((g) => ({
    label: g.title,
    value: g.id,
  }));

  const producerOptions = producers.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  if (loaderError) {
    return (
      <Page title="Upload New Beat">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load upload page" tone="critical">
              <p>{loaderError}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Upload New Beat" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        {storageWarning && (
          <Layout.Section>
            <Banner
              title="Storage warning"
              tone="warning"
              action={{ content: "Fix storage", url: "/app/storage" }}
            >
              <p>{storageWarning}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Upload failed" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {uploadError && (
          <Layout.Section>
            <Banner title="Upload error" tone="critical" onDismiss={() => setUploadError(null)}>
              <p>{uploadError}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="500">
            {/* Beat Details */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Beat Details
                </Text>

                <FormLayout>
                  <TextField
                    label="Beat Title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                    helpText="Enter a catchy title for your beat"
                    requiredIndicator
                  />

                  <FormLayout.Group>
                    <TextField
                      label="BPM"
                      type="number"
                      value={bpm}
                      onChange={setBpm}
                      autoComplete="off"
                      helpText="Beats per minute"
                      requiredIndicator
                    />

                    <Select
                      label="Key"
                      options={keyOptions.map((k) => ({ label: k, value: k }))}
                      value={key}
                      onChange={setKey}
                      requiredIndicator
                    />
                  </FormLayout.Group>

                  <ChoiceList
                    title="Producers"
                    choices={producerOptions}
                    selected={producerGids}
                    onChange={setProducerGids}
                    allowMultiple
                  />

                  <ChoiceList
                    title="Genres"
                    choices={genreOptions}
                    selected={genreGids}
                    onChange={setGenreGids}
                    allowMultiple
                  />

                  <TextField
                    label="Producer Alias (Optional)"
                    value={producerAlias}
                    onChange={setProducerAlias}
                    autoComplete="off"
                    helpText="Alternative name to display"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* License File Assignment */}
            <LicenseFileAssignment
              licenses={licenseTiers}
              uploadedFiles={uploadedFiles}
              licenseFiles={licenseFiles}
              onChange={({ uploadedFiles: newFiles, licenseFiles: newLicenseFiles }) => {
                setUploadedFiles(newFiles);
                setLicenseFiles(newLicenseFiles);
              }}
              onUpload={handleFileUpload}
              uploading={isUploading}
              error={uploadError}
            />

            {/* Submit Button */}
            <Card>
              <Button
                variant="primary"
                size="large"
                icon={UploadIcon}
                onClick={handleSubmit}
                disabled={!isFormValid() || isUploading}
                fullWidth
              >
                {isUploading ? "Uploading..." : "Create Beat Product"}
              </Button>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
