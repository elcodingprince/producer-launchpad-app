import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import { Outlet, useLocation, useRouteLoaderData } from "@remix-run/react";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "~/shopify.server";
import {
  buildManagedPricingUrl,
  getManagedPricingAppHandle,
  isBillingGateEnabled,
} from "~/services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, redirect, session } = await authenticate.admin(request);

  if (!isBillingGateEnabled()) {
    return json({ billingRequired: false });
  }

  const { hasActivePayment } = await billing.check();

  if (!hasActivePayment) {
    return redirect(
      buildManagedPricingUrl(session.shop, getManagedPricingAppHandle()),
      { target: "_top" },
    );
  }

  return json({ billingRequired: true });
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
        <a href="/app/privacy-requests">Privacy</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
    </>
  );
}
