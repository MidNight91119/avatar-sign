import { z } from "zod";
import { SignReferenceSchema } from "@signstream/shared";
import { createGlossTranslator } from "./index";
import { argumentsForCli, readDictionary, readJson } from "./cli";
import { captionsSchema, segmentSchema } from "./schemas";
import { rankWords } from "./vocabulary";
import { SIGN_REFERENCE_DOMAINS } from "../exa";
import type { Segment } from "./types";

const referencesSchema = z.array(
  SignReferenceSchema.refine(
    ({ url }) => /^https?:\/\//.test(url),
    "Reference URL must use HTTP or HTTPS",
  ),
);

const SIGN_PATHS: Readonly<Record<string, RegExp>> = {
  "lifeprint.com": /^\/asl101\/pages-signs\/[^/]+\/[^/]+\.html?$/i,
  "handspeak.com": /^\/word\/\d+\/?$/,
  "signingsavvy.com": /^\/sign\/[^/]+(?:\/[^/]+)*\/?$/i,
  "signasl.org": /^\/sign\/[^/]+\/?$/,
};

export function missingWords(segments: Segment[]) {
  const counts = new Map<string, number>();
  for (const segment of segments)
    for (const sign of segment.signs) {
      if (sign.gloss.startsWith("FS:")) {
        const word = sign.gloss.slice(3);
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export async function missingSignsReport(
  segments: Segment[],
  api?: string,
  limit?: number,
) {
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > 500)
  )
    throw new Error("Reference report limit must be an integer from 1 to 500");
  const report = [];
  for (const entry of missingWords(segments).slice(0, limit)) {
    if (/^\d+$/.test(entry.word)) {
      report.push({
        ...entry,
        references: [],
        referenceStatus: "not-applicable",
      });
      continue;
    }
    if (!/^[A-Za-z][A-Za-z' -]{0,39}$/.test(entry.word)) {
      report.push({
        ...entry,
        references: [],
        referenceStatus: "unsupported-query",
      });
      continue;
    }
    if (!api) {
      report.push({
        ...entry,
        references: [],
        referenceStatus: "not-requested",
      });
      continue;
    }
    const url = new URL("/api/sign-reference", api);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("API URL must use HTTP or HTTPS");
    // Normal casing avoids search operators; a clearer phrase can recover generic results.
    const queries = [
      entry.word.toLowerCase(),
      `the word ${entry.word.toLowerCase()}`,
    ].filter((query) => query.length <= 40);
    try {
      let references: z.infer<typeof referencesSchema> = [];
      let query = queries[0]!;
      for (query of queries) {
        url.searchParams.set("word", query);
        const response = await globalThis.fetch(url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        references = referencesSchema
          .parse(await response.json())
          .filter(({ url }) => {
            const parsed = new URL(url);
            const domain = SIGN_REFERENCE_DOMAINS.find(
              (domain) =>
                parsed.hostname === domain ||
                parsed.hostname.endsWith(`.${domain}`),
            );
            return (
              domain !== undefined &&
              Boolean(SIGN_PATHS[domain]?.test(parsed.pathname))
            );
          });
        if (references.length) break;
      }
      report.push({
        ...entry,
        references,
        referenceStatus: references.length ? "ready" : "unavailable",
        query,
      });
    } catch {
      report.push({ ...entry, references: [], referenceStatus: "unavailable" });
    }
  }
  return report;
}

if (import.meta.main) {
  const args = argumentsForCli();
  const reportLimit =
    args.limit === undefined
      ? undefined
      : z.coerce.number().int().min(1).max(500).parse(args.limit);
  if (Boolean(args.captions) === Boolean(args.track))
    throw new Error(
      "Supply exactly one of --captions captions.json or --track sign-track.json",
    );
  const captions = args.captions
    ? captionsSchema.parse(await readJson(args.captions))
    : undefined;
  const translate = createGlossTranslator({
    ...(!args.live
      ? {
          complete: async () => {
            throw new Error("Offline report");
          },
        }
      : {}),
    log: (event) => {
      if (args.live) globalThis.console.error(JSON.stringify(event));
    },
  });
  if (args.live && !globalThis.process.env.CEREBRAS_API_KEY)
    throw new Error("Live report requires your development CEREBRAS_API_KEY");
  const segments = captions
    ? await translate(captions, {
        lang: "ASL",
        dictionary: await readDictionary(args.dictionary),
      })
    : z
        .object({ segments: z.array(segmentSchema) })
        .parse(await readJson(args.track!)).segments;
  const missing = await missingSignsReport(segments, args.api, reportLimit);
  const distinctMissingWords = missingWords(segments).length;
  const referencesReady =
    Boolean(args.api) &&
    missing.some((entry) => entry.referenceStatus === "ready") &&
    missing.every(
      (entry) =>
        entry.referenceStatus === "ready" ||
        entry.referenceStatus === "not-applicable",
    );
  globalThis.console.log(
    JSON.stringify(
      {
        mode: args.track
          ? "existing-track"
          : args.live
            ? "live"
            : "offline-rule-fallback",
        missing,
        distinctMissingWords,
        reportLimit: reportLimit ?? null,
        reportTruncated: missing.length < distinctMissingWords,
        acceptance: {
          scope:
            "reference availability for reported words only; endpoint provenance requires a live run",
          status: !args.api ? "blocked" : referencesReady ? "passed" : "failed",
        },
        priorities: rankWords(captions ?? segments),
      },
      null,
      2,
    ),
  );
  if (args.check && !referencesReady) globalThis.process.exitCode = 1;
}
