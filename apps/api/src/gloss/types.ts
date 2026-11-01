import type { SignLang } from "@signstream/shared";

// shortcut: shared schemas are not published yet; replace these PLAN §4 shapes when Raashed adds them.
export interface VideoContext {
  topic: string;
  names: string[];
  terms: { term: string; meaning: string }[];
}

export interface Caption {
  start: number;
  end: number;
  text: string;
}

export interface Sign {
  gloss: string;
  start: number;
  duration: number;
  nonManual?: "question" | "negation" | "emphasis";
}

export interface Segment extends Caption {
  signs: Sign[];
}

export interface GlossOptions {
  lang: SignLang;
  dictionary: string[];
  context?: VideoContext;
}
