import { z } from "zod";
import { createGlossTranslator } from "./index";
import { argumentsForCli, readDictionary, readJson } from "./cli";
import { captionsSchema, segmentSchema } from "./schemas";
import { rankWords } from "./vocabulary";
import type { Segment } from "./types";

const referencesSchema = z.array(
  z.object({
    title: z.string(),
    url: z.url({ protocol: /^https?$/ }),
    source: z.string(),
  }),
);

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

export async function missingSignsReport(segments: Segment[], api?: string) {
  const report = [];
  for (const entry of missingWords(segments)) {
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
    url.searchParams.set("word", entry.word);
    try {
      const response = await globalThis.fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      report.push({
        ...entry,
        references: referencesSchema.parse(await response.json()),
        referenceStatus: "ready",
      });
    } catch {
      report.push({ ...entry, references: [], referenceStatus: "unavailable" });
    }
  }
  return report;
}

if (import.meta.main) {
  const args = argumentsForCli();
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
  globalThis.console.log(
    JSON.stringify(
      {
        mode: args.track
          ? "existing-track"
          : args.live
            ? "live"
            : "offline-rule-fallback",
        missing: await missingSignsReport(segments, args.api),
        priorities: rankWords(captions ?? segments),
      },
      null,
      2,
    ),
  );
}
