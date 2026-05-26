import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { createStripeCheckoutSession } from "~/services/billing.server";

export const loader = async () => redirect("/app/settings");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const checkoutUrl = await createStripeCheckoutSession({
      shopDomain: session.shop,
      request,
    });

    return json({ checkoutUrl });
  } catch (error) {
    console.error("[billing] Unable to create Stripe Checkout session:", error);
    return json({ error: "unavailable" as const }, { status: 500 });
  }
};
