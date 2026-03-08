import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "@shopify/shopify-app-remix/server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received webhook for ${shop}: ${topic}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Clean up any shop-specific data if needed
      console.log(`App uninstalled for shop: ${shop}`);
      break;
    case "PRODUCTS_CREATE":
      // Handle product creation if needed
      break;
    case "PRODUCTS_UPDATE":
      // Handle product updates if needed
      break;
    case "PRODUCTS_DELETE":
      // Handle product deletion if needed
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
