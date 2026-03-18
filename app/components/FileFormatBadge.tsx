import { Badge } from "@shopify/polaris";

type FileFormatKey = "mp3" | "wav" | "stems" | "preview" | "cover" | "other";

const FILE_FORMAT_LABELS: Record<FileFormatKey, string> = {
  mp3: "MP3",
  wav: "WAV",
  stems: "STEMS ZIP",
  preview: "PREVIEW MP3",
  cover: "COVER",
  other: "FILE",
};

export function normalizeFileFormat(value: string): FileFormatKey {
  const normalized = value.trim().toLowerCase();

  if (normalized === "mp3") return "mp3";
  if (normalized === "wav") return "wav";
  if (
    normalized === "stems" ||
    normalized === "stems zip" ||
    normalized === "zip"
  ) {
    return "stems";
  }
  if (normalized === "preview" || normalized === "preview mp3") return "preview";
  if (normalized === "cover") return "cover";

  return "other";
}

export function getFileFormatLabel(value: string) {
  return FILE_FORMAT_LABELS[normalizeFileFormat(value)];
}

export function FileFormatBadge({ format }: { format: string }) {
  return <Badge>{getFileFormatLabel(format)}</Badge>;
}
