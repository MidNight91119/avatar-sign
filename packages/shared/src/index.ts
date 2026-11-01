// Shared contracts (PLAN §4). Raashed adds the zod schemas for SignTrack, Segment, Sign and VideoContext here.
export const SIGN_LANGS = ["ASL", "ISL"] as const;
export type SignLang = (typeof SIGN_LANGS)[number];
