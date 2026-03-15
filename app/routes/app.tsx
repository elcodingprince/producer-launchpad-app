import { Outlet, useRouteLoaderData } from "@remix-run/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import enTranslations from "@shopify/polaris/locales/en.json";

export default function AppLayout() {
  const rootData = useRouteLoaderData<{ apiKey: string }>("root");

  return (
    <AppProvider
      apiKey={rootData?.apiKey || ""}
      i18n={enTranslations}
      isEmbeddedApp={false}
    >
      <NavMenu>
        <a href="/app" rel="home">
          Home
        </a>
        <a href="/app/beats">Beats</a>
        <a href="/app/deliveries">Deliveries</a>
        <a href="/app/licenses">Licenses</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}
