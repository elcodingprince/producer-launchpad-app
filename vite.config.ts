import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-plugin-tsconfig-paths";

// CORS preflight middleware — handles OPTIONS before Remix routing
function corsPlugin(): Plugin {
  return {
    name: "cors-preflight",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only handle OPTIONS on API checkout paths
        if (
          req.method === "OPTIONS" &&
          req.url?.startsWith("/api/checkout/")
        ) {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  server: {
    allowedHosts: true,
    hmr: false,
  },
  ssr: {
    noExternal: [/^@shopify/],
  },
  plugins: [
    corsPlugin(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
});
