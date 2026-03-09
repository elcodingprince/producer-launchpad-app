import { useState, useCallback } from "react";
import { useNavigation, useSubmit } from "@remix-run/react";
import {
  Card,
  TextField,
  Select,
  ChoiceList,
  Button,
  DropZone,
  InlineStack,
  BlockStack,
  Text,
  FormLayout,
  Thumbnail,
  ProgressBar,
} from "@shopify/polaris";
import { SoundIcon, ImageIcon, UploadIcon } from "@shopify/polaris-icons";

export interface License {
  id: string;
  handle: string;
  licenseId: string;
  licenseName: string;
  displayName: string;
}

export interface Genre {
  id: string;
  handle: string;
  title: string;
  urlSlug: string;
}

export interface Producer {
  id: string;
  handle: string;
  name: string;
}

export interface BeatUploadFormProps {
  licenses: License[];
  genres: Genre[];
  producers: Producer[];
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const keyOptions = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "D# major", "D# minor",
  "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor",
  "G# major", "G# minor", "A major", "A minor",
  "A# major", "A# minor", "B major", "B minor",
];

export function BeatUploadForm({ licenses, genres, producers }: BeatUploadFormProps) {
  const submit = useSubmit();
  const navigation = useNavigation();

  // Form state
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("C minor");
  const [genreGids, setGenreGids] = useState<string[]>(genres[0]?.id ? [genres[0].id] : []);
  const [producerGids, setProducerGids] = useState<string[]>(
    producers[0]?.id ? [producers[0].id] : []
  );
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

  const uploading =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post";

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
    if (!title || !bpm || !key || genreGids.length === 0 || producerGids.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "upload");
    formData.append("title", title);
    formData.append("bpm", bpm);
    formData.append("key", key);
    formData.append("genreGids", JSON.stringify(genreGids));
    formData.append("producerGids", JSON.stringify(producerGids));
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

  return (
    <BlockStack gap="500">
      <Card>
        <FormLayout>
          <Text variant="headingMd" as="h2">Beat Details</Text>

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
            onChange={(selected) => setProducerGids(selected)}
            allowMultiple
          />

          <ChoiceList
            title="Genres"
            choices={genreOptions}
            selected={genreGids}
            onChange={(selected) => setGenreGids(selected)}
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
      </Card>

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

      {uploading && (
        <Card sectioned>
          <BlockStack gap="200">
            <Text>Uploading your beat...</Text>
            <ProgressBar progress={40} />
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
          genreGids.length === 0 ||
          producerGids.length === 0 ||
          !previewFile
        }
        fullWidth
      >
        {uploading ? "Uploading..." : "Upload Beat"}
      </Button>
    </BlockStack>
  );
}
