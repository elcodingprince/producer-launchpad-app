import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import {
  Outlet,
  useLocation,
  useRouteLoaderData,
} from "@remix-run/react";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "~/shopify.server";
import { getBillingSummary } from "~/services/billing.server";
import { runPrivacyMaintenanceForShop } from "~/services/privacyCompliance.server";
import { triggerQueuedShopDeletionProcessing } from "~/services/shopDeletionJobs.server";

const BILLING_OPEN_PATHS = new Set([
  "/app/settings",
  "/app/billing-portal",
  "/app/billing-checkout",
]);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect, session } = await authenticate.admin(request);
  await runPrivacyMaintenanceForShop(session.shop);
  void triggerQueuedShopDeletionProcessing();

  const url = new URL(request.url);
  const billingSummary = await getBillingSummary({ shopDomain: session.shop });

  if (
    !billingSummary.hasMerchantAccess &&
    !BILLING_OPEN_PATHS.has(url.pathname)
  ) {
    return redirect("/app/settings?billing=required");
  }

  return json({
    billing: {
      status: billingSummary.status,
      access: billingSummary.access,
      hasMerchantAccess: billingSummary.hasMerchantAccess,
    },
  });
};

export default function AppLayout() {
  const rootData = useRouteLoaderData<{ apiKey: string }>("root");

  return (
    <AppProvider
      apiKey={rootData?.apiKey || ""}
      i18n={enTranslations}
      isEmbeddedApp
    >
      <AppChrome />
      <Outlet />
    </AppProvider>
  );
}

function AppChrome() {
  const location = useLocation();
  const shopify = useAppBridge();

  useEffect(() => {
    if (location.pathname === "/app/beats/new") return;

    const cleanupSaveBar = () => {
      void shopify.saveBar.hide("beat-upload-save-bar").catch(() => {});

      if (typeof document !== "undefined") {
        document.querySelectorAll<HTMLElement>('ui-save-bar#beat-upload-save-bar').forEach((element) => {
          (element as unknown as { hide?: () => void }).hide?.();
          element.removeAttribute("open");
          element.remove();
        });
      }
    };

    cleanupSaveBar();
    const frameId = requestAnimationFrame(cleanupSaveBar);
    const timeoutId = window.setTimeout(cleanupSaveBar, 50);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, shopify]);

  return (
    <>
      <NavMenu>
        <a href="/app" rel="home">
          Home
        </a>
        <a href="/app/beats">Beats</a>
        <a href="/app/deliveries">Deliveries</a>
        <a href="/app/licenses">Licenses</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
    </>
  );
}
