import { shopifyApp, LATEST_API_VERSION } from "@shopify/shopify-app-remix/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";

const sessionStorage = new MemorySessionStorage();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  apiVersion: LATEST_API_VERSION,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(",") || [
    "read_products",
    "write_products",
    "read_metaobjects",
    "write_metaobjects",
    "read_shop",
  ],
  appUrl: process.env.SHOPIFY_APP_URL!,
  authPathPrefix: "/auth",
  sessionStorage,
  distribution: process.env.IS_CUSTOM_STORE_APP === "true" 
    ? "singleMerchant" 
    : "appStore",
  future: {
    v3_webhookAdminContext: true,
    v3_authenticatePublic: true,
  },
});

export default shopify;
export const apiVersion = LATEST_API_VERSION;
export const authenticate = shopify.authenticate;
