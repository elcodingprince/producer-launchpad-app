function ensureAbsoluteUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

export function getAppOrigin(request?: Request) {
  const rawHost =
    process.env.SHOPIFY_APP_URL || process.env.APP_URL || process.env.HOST;

  if (rawHost) {
    return ensureAbsoluteUrl(rawHost);
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return "http://localhost:5173";
}

export function buildDownloadPortalUrl(token: string, request?: Request) {
  return `${getAppOrigin(request)}/downloads/${token}`;
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
