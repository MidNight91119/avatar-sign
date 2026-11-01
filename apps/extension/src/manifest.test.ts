import { expect, test } from "bun:test";
import manifest from "../manifest.json";

test("the demo side panel can reach its real localhost API", () => {
  expect(manifest.host_permissions).toContain("http://localhost:8787/*");
  expect(manifest.permissions).toContain("sidePanel");
});
