function ensureAbsoluteUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

function isPlaceholderAppHost(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.includes("your-non-production-app-url.example.com") ||
    normalized === "https://your-app-host" ||
    normalized === "your-app-host" ||
    normalized === "0.0.0.0"
  );
}

export function getConfiguredAppOrigin() {
  const candidates = [
    process.env.SHOPIFY_APP_URL,
    process.env.APP_URL,
    process.env.HOST,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const trimmed = candidate.trim();

    if (!trimmed || isPlaceholderAppHost(trimmed)) {
      continue;
    }

    return ensureAbsoluteUrl(trimmed);
  }

  return null;
}

function normalizeShopifyResourceId(id: string | null | undefined) {
  if (!id) return "";
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

export function getAppOrigin(request?: Request) {
  const configuredOrigin = getConfiguredAppOrigin();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return "http://localhost:5173";
}

export function buildDownloadPortalUrl(token: string, request?: Request) {
  return `${getAppOrigin(request)}/downloads/${token}`;
}

export function buildProductPreviewPlaybackPath(productId: string) {
  const normalizedProductId = normalizeShopifyResourceId(productId);

  if (!normalizedProductId) {
    throw new Error("Product ID is required to build a preview playback path.");
  }

  return `/apps/producer-launchpad/preview/${normalizedProductId}`;
}

export function formatStoreName(shop: string) {
  const baseName = shop.replace(/\.myshopify\.com$/, "");

  if (!baseName) return "your store";

  return baseName
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
