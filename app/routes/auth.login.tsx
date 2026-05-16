import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { login } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);
  return json(errors ?? {});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json(errors ?? {});
};

function getShopErrorMessage(error?: string) {
  if (error === "MISSING_SHOP") {
    return "Enter your shop domain to continue.";
  }

  if (error === "INVALID_SHOP") {
    return "Enter a valid Shopify shop domain, like my-store.myshopify.com.";
  }

  return null;
}

export default function AuthLogin() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const [shop, setShop] = useState(searchParams.get("shop") || "");
  const shopError = getShopErrorMessage(actionData?.shop);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "linear-gradient(180deg, rgba(245,245,245,1) 0%, rgba(255,255,255,1) 100%)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          border: "1px solid #d9d9d9",
          borderRadius: "16px",
          padding: "24px",
          background: "#ffffff",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            lineHeight: 1.1,
            color: "#111827",
          }}
        >
          Open Producer Launchpad
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "14px",
            lineHeight: 1.5,
            color: "#4b5563",
          }}
        >
          Your session needs a quick re-authentication before we can load the
          app.
        </p>

        <Form method="post">
          <label
            htmlFor="shop"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Shop domain
          </label>
          <input
            id="shop"
            name="shop"
            type="text"
            value={shop}
            onChange={(event) => setShop(event.currentTarget.value)}
            placeholder="my-store.myshopify.com"
            autoComplete="on"
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "10px",
              border: shopError ? "1px solid #dc2626" : "1px solid #c7c7c7",
              padding: "0 14px",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {shopError ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "13px",
                color: "#dc2626",
              }}
            >
              {shopError}
            </p>
          ) : null}

          <button
            type="submit"
            style={{
              marginTop: "16px",
              width: "100%",
              height: "44px",
              border: 0,
              borderRadius: "10px",
              background: "#111827",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </Form>
      </section>
    </main>
  );
}
