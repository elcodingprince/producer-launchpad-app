import type { EntryContext, AppLoadContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { addDocumentResponseHeaders } from "./shopify.server";

const CORS_PATHS = ["/api/checkout/"];

const handleRequest = async (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext
) => {
  const url = new URL(request.url);

  // Handle CORS preflight for checkout extension API routes
  if (
    request.method === "OPTIONS" &&
    CORS_PATHS.some((p) => url.pathname.startsWith(p))
  ) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  addDocumentResponseHeaders(request, responseHeaders);

  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response(`<!DOCTYPE html>${markup}`, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
};

export default handleRequest;
