import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";
import manifest from "./manifest.config.ts";

const SIGN_ASSETS_DIR = join(import.meta.dirname, "../../packages/sign-assets");

/** Copies Hasan's clips + dictionary into the build as `sign-assets/`, for `chrome.runtime.getURL("sign-assets/")`. */
function signAssets(): Plugin {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "package.json") return [];
      const path = join(dir, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    });

  return {
    name: "signstream-sign-assets",
    apply: "build",
    generateBundle() {
      if (!existsSync(SIGN_ASSETS_DIR)) return;
      for (const file of files(SIGN_ASSETS_DIR)) {
        if (file.endsWith(".md")) continue;
        this.emitFile({
          type: "asset",
          fileName: `sign-assets/${relative(SIGN_ASSETS_DIR, file)}`,
          source: readFileSync(file),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), signAssets()],
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
    cors: { origin: [/^chrome-extension:\/\//] },
  },
});
