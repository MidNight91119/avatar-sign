import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { dictionarySchema } from "./schemas";

export function argumentsForCli() {
  return parseArgs({
    args: globalThis.process.argv.slice(2),
    options: {
      dictionary: { type: "string" },
      captions: { type: "string" },
      corpus: { type: "string" },
      track: { type: "string" },
      api: { type: "string" },
      live: { type: "boolean", default: false },
      compare: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
    },
  }).values;
}

export async function readJson(path: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readDictionary(path?: string) {
  const dictionary = dictionarySchema.parse(
    await readJson(
      path ??
        new URL(
          "../../../../packages/sign-assets/dictionary.json",
          import.meta.url,
        ),
    ),
  );
  if (dictionary.lang !== "ASL")
    throw new Error("The gloss evaluator requires an ASL dictionary");
  return Object.keys(dictionary.signs);
}
