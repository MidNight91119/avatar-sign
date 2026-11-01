import { defineManifest } from "@crxjs/vite-plugin";
import { normalizeApiOrigin, TOGGLE_COMMAND } from "./src/config.ts";

/** Fixed at build time; the worker can reach this origin and nothing else (PLAN §11). */
export const apiOrigin = normalizeApiOrigin(process.env.VITE_SIGNSTREAM_API_ORIGIN);

export default defineManifest({
  manifest_version: 3,
  name: "SignStream",
  description: "A sign language avatar that signs along with any YouTube video.",
  version: "0.1.0",
  // No popup: clicking the icon opens the side panel (see background/index.ts), like Phantom.
  action: {
    default_title: "SignStream",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "sidePanel"],
  // Only the API origin: the background worker calls it, so youtube.com's CORS rules never apply.
  host_permissions: [`${apiOrigin}/*`],
  // Clips and the avatar model from packages/sign-assets, loaded by the player inside the YouTube page.
  web_accessible_resources: [
    {
      resources: ["sign-assets/*"],
      matches: ["https://www.youtube.com/*"],
    },
  ],
  commands: {
    [TOGGLE_COMMAND]: {
      suggested_key: { default: "Alt+S" },
      description: "Turn SignStream on or off",
    },
  },
});
