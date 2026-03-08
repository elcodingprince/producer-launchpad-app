import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-plugin-tsconfig-paths";

export default defineConfig({
  server: {
    allowedHosts: true,
    hmr: false,
  },
  ssr: {
    noExternal: [/^@shopify/],
  },
  plugins: [
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
