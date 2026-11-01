import { test } from "node:test";
import { strictEqual } from "node:assert";
import { youtubeEmbedUrl } from "./youtube-iframe";

test("the embed navigates directly with the real host origin and IFrame API enabled", () => {
  const url = new URL(youtubeEmbedUrl("TwsgCHYmbbA", "http://localhost:3000"));
  strictEqual(url.origin, "https://www.youtube-nocookie.com");
  strictEqual(url.pathname, "/embed/TwsgCHYmbbA");
  strictEqual(url.searchParams.get("origin"), "http://localhost:3000");
  strictEqual(url.searchParams.get("enablejsapi"), "1");
  strictEqual(url.searchParams.get("playsinline"), "1");
});
