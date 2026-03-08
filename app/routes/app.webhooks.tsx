import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received webhook for ${shop}: ${topic}`);

  if (topic === "APP_UNINSTALLED") {
    // TODO: clean up shop-specific rows from your own tables.
    console.log(`App uninstalled for shop: ${shop}`);
  } else {
    console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
