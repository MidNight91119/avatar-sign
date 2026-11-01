import type { Caption } from "./types";

export const SYNONYMS: Readonly<Record<string, string>> = {
  LARGE: "BIG",
  HUGE: "BIG",
  ENORMOUS: "BIG",
  PURCHASE: "BUY",
  BOUGHT: "BUY",
  CHILDREN: "CHILD",
  KIDS: "CHILD",
  KID: "CHILD",
  AUTOMOBILE: "CAR",
  VEHICLE: "CAR",
  WENT: "GO",
  GOING: "GO",
  GOES: "GO",
  WALKED: "WALK",
  RUNNING: "RUN",
  RAN: "RUN",
  ATE: "EAT",
  EATING: "EAT",
  DRANK: "DRINK",
  DRINKING: "DRINK",
  SAW: "SEE",
  SEEN: "SEE",
  WATCHED: "WATCH",
  WATCHING: "WATCH",
  LEARNING: "LEARN",
  LEARNED: "LEARN",
  WORKING: "WORK",
  WORKED: "WORK",
  HELPING: "HELP",
  HELPED: "HELP",
  UNDERSTOOD: "UNDERSTAND",
  WANTED: "WANT",
  WANTS: "WANT",
  LIKED: "LIKE",
  LIKES: "LIKE",
  LOVED: "LOVE",
  ME: "I",
  WE: "WE",
  US: "WE",
  MINE: "MY",
  YOURS: "YOUR",
  MOM: "MOTHER",
  DAD: "FATHER",
  HI: "HELLO",
  THANKS: "THANK-YOU",
  YES: "YES",
  NOPE: "NO",
  OKAY: "OK",
  ARRAYS: "ARRAY",
  ELEMENTS: "ELEMENT",
  VALUES: "VALUE",
  NUMBERS: "NUMBER",
  OPERATORS: "OPERATOR",
  LOOPS: "LOOP",
  FUNCTIONS: "FUNCTION",
  VARIABLES: "VARIABLE",
  INTEGERS: "INTEGER",
  STRINGS: "STRING",
  COMPARING: "COMPARE",
  CHECKING: "CHECK",
  REPEATING: "REPEAT",
  SORTED: "SORT",
};

const STOPWORDS = new Set(
  "A AN THE AM IS ARE WAS WERE BE BEEN BEING TO OF DO DOES DID".split(" "),
);

export function cleanText(text: string): string {
  return text
    .replace(
      /\[(?:music|applause|laughter|laughing|cheering|silence|inaudible|noise|speaker\s*\d+)[^\]]*\]/gi,
      " ",
    )
    .replace(/\((?:music|applause|laughter)\)/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /^\s*(?:>>\s*)?(?:(?:[A-Z][a-z]*|[A-Z]+)(?:\s+[A-Z][a-z]*){0,2}|speaker\s*\d+)\s*:\s*/i,
      "",
    )
    .replace(/>>|[♪♫]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  return (
    text
      .toUpperCase()
      .match(
        /(?<!\p{L})[-+]?(?:\d+(?:[.,]\d+)*|\.\d+)%?|[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu,
      ) ?? []
  );
}

export function fallbackTokens(text: string): string[] {
  return words(
    text
      .replace(/[’‘]/g, "'")
      .replace(
        /\b(?:don't|doesn't|didn't|isn't|aren't|wasn't|weren't|can't|cannot|couldn't|won't|wouldn't|shouldn't)\b/gi,
        " NOT ",
      )
      .replace(/\bI'm\b/gi, "I")
      .replace(/\b(you|we|they)'re\b/gi, "$1")
      .replace(/\b(it|that|he|she)'s\b/gi, "$1"),
  ).filter((word) => !STOPWORDS.has(word));
}

export function normalizeTokens(
  tokens: string[],
  dictionary: ReadonlySet<string>,
): string[] {
  return tokens.flatMap((raw) => {
    const token = raw.trim().toUpperCase();
    if (!token) return [];
    const fingerspelled = token.startsWith("FS:");
    if (dictionary.has(token)) return [token];
    return words(fingerspelled ? token.slice(3) : token).flatMap((word) => {
      const number = word.match(/^([-+]?)(\d[\d,]*)?(?:\.(\d+))?(%)?$/);
      if (number)
        return [
          ...(number[1] ? [`FS:${number[1] === "-" ? "MINUS" : "PLUS"}`] : []),
          `FS:${number[2]?.replaceAll(",", "") ?? "0"}`,
          ...(number[3] ? ["FS:POINT", `FS:${number[3]}`] : []),
          ...(number[4] ? ["FS:PERCENT"] : []),
        ];
      if (!fingerspelled) {
        if (dictionary.has(word) && !/^\d/.test(word)) return [word];
        const synonym = SYNONYMS[word];
        if (synonym && dictionary.has(synonym)) return [synonym];
      }
      // The player receives letters/digits, never punctuation it cannot animate.
      const spelling = word.replace(/[^\p{L}\p{N}]/gu, "");
      return spelling ? [`FS:${spelling}`] : [];
    });
  });
}

export function prepareCaptions(captions: Caption[]): Caption[] {
  return captions.flatMap((caption, index) => {
    const text = cleanText(caption.text);
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 20) return [{ ...caption, text: caption.text }];
    const end = Math.min(
      caption.end,
      captions[index + 1]?.start ?? caption.end,
    );
    const chunks: Caption[] = [];
    for (let i = 0; i < parts.length; i += 20) {
      chunks.push({
        start: caption.start + ((end - caption.start) * i) / parts.length,
        end:
          caption.start +
          ((end - caption.start) * Math.min(i + 20, parts.length)) /
            parts.length,
        text: parts.slice(i, i + 20).join(" "),
      });
    }
    return chunks;
  });
}
