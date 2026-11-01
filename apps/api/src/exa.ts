/**
 * Exa features (PLAN §2.1, spec §2–3): video context, /discover and /sign-reference.
 *
 * Every function takes a small `ExaSearch` interface, so tests use a fake and production uses
 * `exa-js`. Exa is never allowed to block glossing for long: context has a timeout and returns
 * `undefined` on any failure.
 */
import Exa from "exa-js";
import {
  VideoContextSchema,
  videoContextJsonSchema,
  type DiscoverResult,
  type SignReference,
  type VideoContext,
} from "@signstream/shared";

export interface ExaResult {
  title?: string | null;
  url: string;
  highlights?: string[];
}

export interface ExaSearchOptions {
  type: "auto";
  numResults: number;
  includeDomains?: string[];
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
  contents?: { highlights: true };
}

export interface ExaSearchResponse {
  results: ExaResult[];
  /** Structured output when `outputSchema` was given. */
  output?: { content?: unknown } | null;
}

/** The one Exa call we use. */
export type ExaSearch = (query: string, options: ExaSearchOptions) => Promise<ExaSearchResponse>;

/** Production search backed by exa-js. Returns undefined when there is no key. */
export function createExaSearch(apiKey: string | undefined): ExaSearch | undefined {
  if (!apiKey) return undefined;
  const exa = new Exa(apiKey);
  return async (query, options) => {
    const res = (await exa.search(query, options as never)) as unknown as ExaSearchResponse;
    return { results: res.results ?? [], output: res.output };
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Exa returns structured output as an object or as a JSON string. */
function parseContent(content: unknown): unknown {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

/** Exa's outputSchema takes a plain JSON schema; drop the draft marker zod adds. */
const { $schema: _draft, ...contextOutputSchema } = videoContextJsonSchema as Record<string, unknown>;

export interface ContextOptions {
  /** Give up after this long (spec: 4s). Glossing continues without context. */
  timeoutMs?: number;
  onError?: (error: unknown) => void;
}

/**
 * Background on a video's topic, names and terms, as structured JSON from Exa (`outputSchema`).
 * Falls back to the highlights as the topic when structured output is missing or invalid.
 */
export async function getVideoContext(
  search: ExaSearch | undefined,
  title: string,
  description: string,
  opts: ContextOptions = {},
): Promise<VideoContext | undefined> {
  if (!search || !title.trim()) return undefined;
  try {
    const res = await withTimeout(
      search(`${title}. ${description.slice(0, 200)}`.trim(), {
        type: "auto",
        numResults: 5,
        systemPrompt: "Find background on this video's topic, people, places and technical terms.",
        outputSchema: contextOutputSchema,
        contents: { highlights: true },
      }),
      opts.timeoutMs ?? 4000,
    );
    const parsed = VideoContextSchema.safeParse(parseContent(res.output?.content));
    if (parsed.success) return parsed.data;
    const highlights = res.results.flatMap((r) => r.highlights ?? []).join(" ").slice(0, 1500).trim();
    return highlights ? { topic: highlights, names: [], terms: [] } : undefined;
  } catch (e) {
    opts.onError?.(e);
    return undefined;
  }
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extracts the video id from youtube.com/watch?v= URLs only (not Shorts, channels or playlists). */
export function youtubeWatchId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname) || u.pathname !== "/watch") return undefined;
    const id = u.searchParams.get("v");
    return id && YT_ID.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/** YouTube videos about a topic (`/api/discover`). */
export async function discoverVideos(search: ExaSearch, q: string): Promise<DiscoverResult[]> {
  const res = await search(q, {
    type: "auto",
    includeDomains: ["youtube.com"],
    numResults: 10,
    contents: { highlights: true },
  });
  const seen = new Set<string>();
  const out: DiscoverResult[] = [];
  for (const r of res.results) {
    const videoId = youtubeWatchId(r.url);
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    out.push({
      videoId,
      title: r.title?.trim() || "Untitled video",
      url: `https://www.youtube.com/watch?v=${videoId}`,
      snippet: r.highlights?.[0]?.trim() ?? "",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  return out;
}

export const SIGN_REFERENCE_DOMAINS = ["handspeak.com", "lifeprint.com", "signingsavvy.com", "signasl.org"];

function domainOf(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SIGN_REFERENCE_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return undefined;
  }
}

/** How-to-sign pages for a word (`/api/sign-reference`), only from the trusted ASL sites. */
export async function findSignReferences(search: ExaSearch, word: string): Promise<SignReference[]> {
  const res = await search(`how to sign ${word} in ASL`, {
    type: "auto",
    includeDomains: SIGN_REFERENCE_DOMAINS,
    numResults: 3,
    contents: { highlights: true },
  });
  return res.results.flatMap((r) => {
    const source = domainOf(r.url);
    if (!source) return [];
    const highlight = r.highlights?.[0]?.trim();
    return [{ title: r.title?.trim() || `How to sign "${word}"`, url: r.url, source, ...(highlight ? { highlight } : {}) }];
  });
}
