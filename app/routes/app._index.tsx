import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  Select,
  Button,
  DropZone,
  Banner,
  InlineStack,
  BlockStack,
  Text,
  FormLayout,
  Tag,
  List,
  InlineError,
  ProgressBar,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Badge,
} from "@shopify/polaris";
import { SoundIcon, ImageIcon, UploadIcon } from "@shopify/polaris-icons";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const productService = createProductCreatorService(session, admin);

  try {
    let setupStatus = await setupService.checkSetupStatus();
    let onboarding: {
      attemptedAutoSetup: boolean;
      autoSetupSuccess: boolean;
      errors: string[];
    } = {
      attemptedAutoSetup: false,
      autoSetupSuccess: false,
      errors: [],
    };

    if (!setupStatus.isComplete) {
      onboarding.attemptedAutoSetup = true;
      const setupResult = await setupService.runFullSetup();
      onboarding.autoSetupSuccess = setupResult.success;
      onboarding.errors = setupResult.errors;
      setupStatus = await setupService.checkSetupStatus();
    }

    const [licenses, genres, producers] = setupStatus.isComplete
      ? await Promise.all([
          productService.getLicenseMetaobjects(),
          productService.getGenreMetaobjects(),
          productService.getProducerMetaobjects(),
        ])
      : [[], [], []];

    return json({
      setupStatus,
      licenses,
      genres,
      producers,
      onboarding,
      error: null,
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json(
      {
        setupStatus: null,
        licenses: [],
        genres: [],
        producers: [],
        onboarding: null,
        error: error instanceof Error ? error.message : "Failed to load dashboard data",
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

      return json({
        success: true,
        productId: result.productId,
        variants: result.variants,
      });
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

export default function Dashboard() {
  const { setupStatus, licenses, genres, producers, onboarding, error: loaderError } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("C minor");
  const [genre, setGenre] = useState(genres[0]?.id || "");
  const [producer, setProducer] = useState(producers[0]?.id || "");
  const [producerAlias, setProducerAlias] = useState("");
  const [licensePrices, setLicensePrices] = useState<
    Array<{ licenseId: string; licenseGid: string; price: string }>
  >(
    licenses.map((l) => ({
      licenseId: l.licenseId,
      licenseGid: l.id,
      price: "29.99",
    }))
  );

  // File upload states
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [stemsFile, setStemsFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDrop = useCallback(
    (
      files: File[],
      setFile: (file: File | null) => void,
      allowedTypes: string[]
    ) => {
      if (files.length > 0) {
        const file = files[0];
        if (allowedTypes.includes(file.type)) {
          setFile(file);
        }
      }
    },
    []
  );

  const handleUpload = () => {
    if (!title || !bpm || !key || !genre || !producer) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("intent", "upload");
    formData.append("title", title);
    formData.append("bpm", bpm);
    formData.append("key", key);
    formData.append("genre", genre);
    formData.append("producer", producer);
    formData.append("producerAlias", producerAlias);
    formData.append(
      "licensePrices",
      JSON.stringify(
        licensePrices.map((lp) => ({
          licenseId: lp.licenseId,
          licenseGid: lp.licenseGid,
          price: parseFloat(lp.price),
        }))
      )
    );

    if (previewFile) formData.append("previewFile", previewFile);
    if (mp3File) formData.append("mp3File", mp3File);
    if (stemsFile) formData.append("stemsFile", stemsFile);
    if (coverArtFile) formData.append("coverArtFile", coverArtFile);

    submit(formData, { method: "post", encType: "multipart/form-data" });
  };

  const genreOptions = genres.map((g) => ({
    label: g.title,
    value: g.id,
  }));

  const producerOptions = producers.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const keyOptions = [
    "C major",
    "C minor",
    "C# major",
    "C# minor",
    "D major",
    "D minor",
    "D# major",
    "D# minor",
    "E major",
    "E minor",
    "F major",
    "F minor",
    "F# major",
    "F# minor",
    "G major",
    "G minor",
    "G# major",
    "G# minor",
    "A major",
    "A minor",
    "A# major",
    "A# minor",
    "B major",
    "B minor",
  ];

  if (loaderError || !setupStatus) {
    return (
      <Page title="Producer Launchpad">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load dashboard" status="critical">
              <p>{loaderError || "Failed to load dashboard data."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!setupStatus.isComplete) {
    return (
      <Page title="Producer Launchpad">
        <Layout>
          {onboarding?.attemptedAutoSetup && onboarding.autoSetupSuccess && (
            <Layout.Section>
              <Banner title="Initial setup ran automatically" status="info">
                <p>
                  We set up as much as possible automatically. Finish the remaining
                  steps in Setup if needed.
                </p>
              </Banner>
            </Layout.Section>
          )}
          {onboarding?.attemptedAutoSetup &&
            onboarding.errors &&
            onboarding.errors.length > 0 && (
              <Layout.Section>
                <Banner title="Automatic setup hit issues" status="critical">
                  <List type="bullet">
                    {onboarding.errors.map((error) => (
                      <List.Item key={error}>{error}</List.Item>
                    ))}
                  </List>
                </Banner>
              </Layout.Section>
            )}
          <Layout.Section>
            <Banner
              title="Setup Required"
              status="warning"
              action={{ content: "Go to Setup", url: "/app/setup" }}
            >
              <p>
                Your store needs to be configured before you can upload beats.
                Please run the setup wizard first.
              </p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Producer Launchpad">
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner title="Beat uploaded successfully!" status="success">
              <p>Your beat has been created with {actionData.variants.length} license variants.</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Upload failed" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <FormLayout>
              <Text variant="headingMd" as="h2">Upload New Beat</Text>

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

              <FormLayout.Group>
                <Select
                  label="Genre"
                  options={genreOptions}
                  value={genre}
                  onChange={setGenre}
                  requiredIndicator
                />

                <Select
                  label="Producer"
                  options={producerOptions}
                  value={producer}
                  onChange={setProducer}
                  requiredIndicator
                />
              </FormLayout.Group>

              <TextField
                label="Producer Alias (Optional)"
                value={producerAlias}
                onChange={setProducerAlias}
                autoComplete="off"
                helpText="Alternative name to display"
              />
            </FormLayout>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Audio Files" sectioned>
            <BlockStack gap="500">
              <div>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Preview MP3 (Required)
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Watermarked preview for the audio player
                </Text>
                <DropZone
                  onDrop={(files) =>
                    handleDrop(files, setPreviewFile, ["audio/mpeg"])
                  }
                  accept="audio/mpeg"
                  type="file"
                >
                  {previewFile ? (
                    <InlineStack blockAlign="center" gap="200">
                      <Thumbnail
                        source={SoundIcon}
                        alt={previewFile.name}
                        size="small"
                      />
                      <Text variant="bodyMd" as="p">{previewFile.name}</Text>
                    </InlineStack>
                  ) : (
                    <DropZone.FileUpload actionHint="Accepts .mp3 up to 100MB" />
                  )}
                </DropZone>
              </div>

              <div>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Untagged MP3 (Optional)
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Full untagged MP3 for Basic license buyers
                </Text>
                <DropZone
                  onDrop={(files) => handleDrop(files, setMp3File, ["audio/mpeg"])}
                  accept="audio/mpeg"
                  type="file"
                >
                  {mp3File ? (
                    <InlineStack blockAlign="center" gap="200">
                      <Thumbnail
                        source={SoundIcon}
                        alt={mp3File.name}
                        size="small"
                      />
                      <Text variant="bodyMd" as="p">{mp3File.name}</Text>
                    </InlineStack>
                  ) : (
                    <DropZone.FileUpload actionHint="Accepts .mp3 up to 100MB" />
                  )}
                </DropZone>
              </div>

              <div>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Stems ZIP (Optional)
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  ZIP file with track stems for Unlimited license buyers
                </Text>
                <DropZone
                  onDrop={(files) =>
                    handleDrop(files, setStemsFile, ["application/zip"])
                  }
                  accept=".zip"
                  type="file"
                >
                  {stemsFile ? (
                    <InlineStack blockAlign="center" gap="200">
                      <Thumbnail
                        source={SoundIcon}
                        alt={stemsFile.name}
                        size="small"
                      />
                      <Text variant="bodyMd" as="p">{stemsFile.name}</Text>
                    </InlineStack>
                  ) : (
                    <DropZone.FileUpload actionHint="Accepts .zip up to 500MB" />
                  )}
                </DropZone>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Cover Art" sectioned>
            <DropZone
              onDrop={(files) =>
                handleDrop(files, setCoverArtFile, [
                  "image/jpeg",
                  "image/png",
                ])
              }
              accept="image/jpeg,image/png"
              type="image"
            >
              {coverArtFile ? (
                <InlineStack blockAlign="center" gap="200">
                  <Thumbnail
                    source={ImageIcon}
                    alt={coverArtFile.name}
                    size="small"
                  />
                  <Text variant="bodyMd" as="p">{coverArtFile.name}</Text>
                </InlineStack>
              ) : (
                <DropZone.FileUpload actionHint="Accepts .jpg, .png up to 10MB" />
              )}
            </DropZone>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="License Pricing" sectioned>
            <BlockStack gap="500">
              {licensePrices.map((lp, index) => {
                const license = licenses.find((l) => l.licenseId === lp.licenseId);
                return (
                  <FormLayout key={lp.licenseId}>
                    <TextField
                      label={`${license?.displayName || lp.licenseId} License Price`}
                      type="number"
                      prefix="$"
                      value={lp.price}
                      onChange={(value) => {
                        const newPrices = [...licensePrices];
                        newPrices[index] = { ...lp, price: value };
                        setLicensePrices(newPrices);
                      }}
                      autoComplete="off"
                      helpText={license?.licenseName}
                    />
                  </FormLayout>
                );
              })}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {uploading && (
            <Card sectioned>
              <BlockStack gap="200">
                <Text>Uploading your beat...</Text>
                <ProgressBar progress={uploadProgress} />
              </BlockStack>
            </Card>
          )}

          <Button
            primary
            size="large"
            icon={UploadIcon}
            onClick={handleUpload}
            disabled={
              uploading ||
              !title ||
              !bpm ||
              !key ||
              !genre ||
              !producer ||
              !previewFile
            }
            fullWidth
          >
            {uploading ? "Uploading..." : "Upload Beat"}
          </Button>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
