export type DeliveryFormat = "mp3" | "wav" | "stems";
export type StemsPolicy =
  | "not_available"
  | "available_as_addon"
  | "included_by_default";

export const DELIVERY_FORMAT_ORDER: DeliveryFormat[] = ["mp3", "wav", "stems"];

export function normalizeDeliveryFormat(value: string): DeliveryFormat | null {
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

  return null;
}

export function stemsIncludedByDefault(stemsPolicy?: string | null) {
  return stemsPolicy === "included_by_default";
}

export function stemsAvailableAsAddon(stemsPolicy?: string | null) {
  return stemsPolicy === "available_as_addon";
}

export function licenseOffersStems(stemsPolicy?: string | null) {
  return (
    stemsIncludedByDefault(stemsPolicy) || stemsAvailableAsAddon(stemsPolicy)
  );
}

export function getRequiredDeliveryFormats(license: {
  fileFormats?: string;
  stemsPolicy?: string;
}): DeliveryFormat[] {
  const selected = new Set<DeliveryFormat>();

  String(license.fileFormats || "")
    .split(",")
    .map((format) => normalizeDeliveryFormat(format))
    .filter((format): format is DeliveryFormat => Boolean(format))
    .forEach((format) => selected.add(format));

  if (stemsIncludedByDefault(license.stemsPolicy)) {
    selected.add("stems");
  }

  return DELIVERY_FORMAT_ORDER.filter((format) => selected.has(format));
}

export function formatDeliveryFormatLabel(format: DeliveryFormat) {
  return format === "stems" ? "STEMS ZIP" : format.toUpperCase();
}
