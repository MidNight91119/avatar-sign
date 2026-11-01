// Gives `bun test` a browser-like DOM (document, Shadow DOM, events) on a youtube.com URL.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://www.youtube.com/" });
