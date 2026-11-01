import type { SignLang, VideoContext } from "@signstream/shared";
export type { Caption, Segment, Sign, VideoContext } from "@signstream/shared";

export interface GlossOptions {
  lang: SignLang;
  dictionary: string[];
  context?: VideoContext;
}
