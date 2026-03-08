import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const shopify = shopifyApi({
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
  isCustomStoreApp: process.env.IS_CUSTOM_STORE_APP === "true",
  isEmbeddedApp: true,
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https:\/\//, "") || "",
  hostScheme: "https",
  restResources,
});

export const sessionStorage = new PrismaSessionStorage(prisma);

export default shopify;
