/** Reads Hasan's sign dictionary (packages/sign-assets/dictionary.json) for /api/signs and the gloss. */
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SignLang } from "@signstream/shared";

interface DictionaryFile {
  lang: SignLang;
  signs: Record<string, string>;
}

/** Re-reads the file when it changes, so new clips show up without a restart. */
export function createDictionary(path = fileURLToPath(import.meta.resolve("@signstream/sign-assets/dictionary.json"))) {
  let mtime = -1;
  let file: DictionaryFile = { lang: "ASL", signs: {} };
  return (lang: SignLang): string[] => {
    const m = statSync(path).mtimeMs;
    if (m !== mtime) {
      file = JSON.parse(readFileSync(path, "utf8")) as DictionaryFile;
      mtime = m;
    }
    return file.lang === lang ? Object.keys(file.signs).sort() : [];
  };
}
