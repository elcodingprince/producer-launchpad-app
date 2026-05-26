import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { createStripeCustomerPortalSession } from "~/services/billing.server";

export const loader = async () => redirect("/app/settings");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const portalUrl = await createStripeCustomerPortalSession({
      shopDomain: session.shop,
      request,
    });

    return json({ portalUrl });
  } catch (error) {
    console.error("[billing] Unable to create Stripe Customer Portal:", error);
    return json({ error: "unavailable" as const }, { status: 500 });
  }
};
