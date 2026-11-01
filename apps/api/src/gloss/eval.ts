import { createGlossTranslator } from "./index";
import { argumentsForCli, readDictionary } from "./cli";
import { EVAL_CASES } from "./eval-cases";
import { normalizeTokens } from "./words";

export async function evaluate(
  live: boolean,
  dictionary: string[],
  compare = false,
) {
  const env = globalThis.process.env;
  if (live && !env.CEREBRAS_API_KEY)
    throw new Error("Live eval requires your development CEREBRAS_API_KEY");
  if (compare && !live)
    throw new Error(
      "Model comparison requires --live and your development key",
    );
  const models = compare
    ? ["gpt-oss-120b", "qwen-3.8-27b"]
    : [env.CEREBRAS_MODEL ?? "gpt-oss-120b"];
  const reports = [];
  for (const model of models) {
    let fallbackBatches = 0;
    let tokenCount = 0;
    const translate = createGlossTranslator({
      model,
      ...(!live
        ? {
            complete: async () => {
              throw new Error("Offline evaluation");
            },
          }
        : {}),
      log: (event) => {
        if (event.event === "gloss.video") {
          fallbackBatches += Number(event.fallbackBatches);
          tokenCount += Number(event.totalTokens);
        }
        if (live && event.event === "gloss.call")
          globalThis.console.error(JSON.stringify(event));
      },
    });
    const started = performance.now();
    const cases = [];
    const selected = compare ? EVAL_CASES.slice(0, 10) : EVAL_CASES;
    const groups = [
      selected.filter(({ context }) => !context),
      ...selected
        .filter(({ context }) => context)
        .map((testCase) => [testCase]),
    ];
    for (const group of groups) {
      const segments = await translate(
        group.map(({ text }, index) => ({
          start: index * 12,
          end: index * 12 + 10,
          text,
        })),
        {
          lang: "ASL",
          dictionary,
          context: group[0]?.context,
        },
      );
      const withoutContext = group[0]?.context
        ? await translate(
            group.map(({ text }, index) => ({
              start: index * 12,
              end: index * 12 + 10,
              text,
            })),
            { lang: "ASL", dictionary },
          )
        : undefined;
      for (const [index, testCase] of group.entries()) {
        const actual = segments[index]?.signs.map(({ gloss }) => gloss) ?? [];
        const expected = normalizeTokens(
          testCase.expected,
          new Set(dictionary),
        );
        cases.push({
          text: testCase.text,
          context: Boolean(testCase.context),
          expected,
          actual,
          exactMatch: JSON.stringify(actual) === JSON.stringify(expected),
          ...(withoutContext
            ? {
                withoutContext:
                  withoutContext[index]?.signs.map(({ gloss }) => gloss) ?? [],
                withoutContextMatch:
                  JSON.stringify(
                    withoutContext[index]?.signs.map(({ gloss }) => gloss) ??
                      [],
                  ) === JSON.stringify(expected),
              }
            : {}),
        });
      }
    }
    const tokens = cases.flatMap(({ actual }) => actual);
    const realSigns = tokens.filter((token) => !token.startsWith("FS:")).length;
    reports.push({
      mode: live ? "live" : "offline-rule-fallback",
      model,
      elapsedMs: performance.now() - started,
      providerTokens: tokenCount,
      fallbackBatches,
      dictionarySize: dictionary.length,
      sentences: cases.length,
      realSigns,
      fingerspelled: tokens.length - realSigns,
      coveragePercent: tokens.length ? (100 * realSigns) / tokens.length : 0,
      exactMatches: cases.filter(({ exactMatch }) => exactMatch).length,
      contextMatches: cases.filter(
        ({ context, exactMatch }) => context && exactMatch,
      ).length,
      contextImprovements: cases.filter(
        ({ context, exactMatch, withoutContextMatch }) =>
          context && exactMatch && !withoutContextMatch,
      ).length,
      contextRegressions: cases.filter(
        ({ context, exactMatch, withoutContextMatch }) =>
          context && !exactMatch && withoutContextMatch,
      ).length,
      cases,
    });
  }
  return reports;
}

if (import.meta.main) {
  const args = argumentsForCli();
  globalThis.console.log(
    JSON.stringify(
      await evaluate(
        args.live,
        await readDictionary(args.dictionary),
        args.compare,
      ),
      null,
      2,
    ),
  );
}
