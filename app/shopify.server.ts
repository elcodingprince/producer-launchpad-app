import "@shopify/shopify-app-remix/adapters/node";
import {
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { DeliveryMethod } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const rawHost =
  process.env.SHOPIFY_APP_URL || process.env.APP_URL || process.env.HOST;
const appUrl = rawHost
  ? rawHost.startsWith("http://") || rawHost.startsWith("https://")
    ? rawHost
    : `https://${rawHost}`
  : "http://localhost:5173";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  appUrl,
  apiVersion: LATEST_API_VERSION,
  scopes: (
    process.env.SHOPIFY_APP_SCOPES ||
    "read_products,write_products,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions"
  ).split(","),
  isEmbeddedApp: true,
  authPathPrefix: "/auth",
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  sessionStorage: new PrismaSessionStorage(prisma),
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      await shopify.registerWebhooks({ session });
    },
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
