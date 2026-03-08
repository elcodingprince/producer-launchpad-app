import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { createMetafieldSetupService } from "../services/metafieldSetup";

// This route redirects to the main upload interface on the dashboard
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const setupStatus = await setupService.checkSetupStatus();

  if (!setupStatus.isComplete) {
    return redirect("/app/setup");
  }

  return redirect("/app");
};
