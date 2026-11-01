/**
 * What a sign track was built from (spec R-I6): the gloss code (prompt, timing, word rules),
 * the dictionary and the model. A cached track whose revision differs from the current one is
 * stale and should be rebuilt with `demo refresh --stale` before a demo.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface TrackRevision {
  /** Hash of the gloss module's source (not its tests). */
  gloss: string;
  /** Hash of the dictionary glosses used for the build. */
  dictionary: string;
  model: string;
}

const short = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);

const GLOSS_DIR = fileURLToPath(new URL("./gloss/", import.meta.url));

/** Hashes the gloss module's runtime files: `.ts` sources and `.json` data, excluding tests and evidence. */
export function glossRevision(dir = GLOSS_DIR): string {
  const files = readdirSync(dir)
    .filter((f) => /\.(ts|json)$/.test(f) && !/\.test\.ts$/.test(f) && f !== "live-results.json")
    .sort();
  return short(files.map((f) => `${f}\n${readFileSync(join(dir, f), "utf8")}`).join("\n"));
}

export function dictionaryRevision(glosses: string[]): string {
  return short([...glosses].sort().join("\n"));
}

export function sameRevision(a: TrackRevision | undefined, b: TrackRevision): boolean {
  return !!a && a.gloss === b.gloss && a.dictionary === b.dictionary && a.model === b.model;
}

/** The current commit, for the export's run log. Undefined outside a git checkout. */
export function gitCommit(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}
