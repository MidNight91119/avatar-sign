import { expect, it } from "bun:test";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDictionary } from "./dictionary";

it("reads the sign-assets dictionary and picks up changes", () => {
  const path = join(mkdtempSync(join(tmpdir(), "dict-")), "dictionary.json");
  writeFileSync(path, JSON.stringify({ lang: "ASL", signs: { NAME: "a", HELLO: "b" }, letters: {} }));
  const dict = createDictionary(path);
  expect(dict("ASL")).toEqual(["HELLO", "NAME"]);
  expect(dict("ISL")).toEqual([]);
  writeFileSync(path, JSON.stringify({ lang: "ASL", signs: { BYE: "c" }, letters: {} }));
  utimesSync(path, new Date(), new Date(Date.now() + 5000));
  expect(dict("ASL")).toEqual(["BYE"]);
});

it("loads the real packages/sign-assets dictionary by default", () => {
  expect(Array.isArray(createDictionary()("ASL"))).toBe(true);
});
