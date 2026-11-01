/**
 * PLACEHOLDER gloss module (owner: Durgesh, spec D3–D7).
 *
 * Implements the PLAN §4.2 contract with a simple rule-only gloss so the API runs end to end
 * before the real Cerebras module lands. Durgesh replaces the body of `textToSigns`; the
 * signature must stay the same.
 */
import type { Caption, Segment, Sign, SignLang, VideoContext } from "@signstream/shared";

export interface TextToSignsOptions {
  lang: SignLang;
  /** Glosses the avatar can play (keys of dictionary.json `signs`). */
  dictionary: string[];
  /** Background from Exa. Optional: glossing must work without it. */
  context?: VideoContext;
}

const STOPWORDS = new Set(["a", "an", "the", "is", "am", "are", "was", "were", "be", "to", "of", "and", "um", "uh"]);

/** Turns caption text into gloss tokens: drop filler words, use dictionary words, fingerspell the rest. */
export function ruleGloss(text: string, dictionary: Set<string>): string[] {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .split(/[^A-Za-z0-9']+/)
    .map((w) => w.replace(/'/g, "").toUpperCase())
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
    .map((w) => (dictionary.has(w) ? w : `FS:${w}`));
}

/** Spreads gloss tokens evenly over a caption window, without overlaps. */
export function spreadSigns(glosses: string[], start: number, end: number): Sign[] {
  if (glosses.length === 0) return [];
  const slot = Math.max(end - start, 0.25) / glosses.length;
  return glosses.map((gloss, i) => ({
    gloss,
    start: Number((start + i * slot).toFixed(3)),
    duration: Number(Math.max(slot, 0.01).toFixed(3)),
  }));
}

export async function textToSigns(captions: Caption[], opts: TextToSignsOptions): Promise<Segment[]> {
  const dictionary = new Set(opts.dictionary.map((g) => g.toUpperCase()));
  return captions.map((c) => ({
    start: c.start,
    end: c.end,
    text: c.text,
    signs: spreadSigns(ruleGloss(c.text, dictionary), c.start, c.end),
  }));
}
