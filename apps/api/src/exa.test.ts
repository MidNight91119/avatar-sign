import { describe, expect, it } from "bun:test";
import {
  SIGN_REFERENCE_DOMAINS,
  createExaSearch,
  discoverVideos,
  excerpt,
  findSignReferences,
  getVideoContext,
  youtubeWatchId,
  type ExaSearch,
  type ExaSearchOptions,
  type ExaSearchResponse,
} from "./exa";

function fakeSearch(response: ExaSearchResponse | (() => Promise<ExaSearchResponse>)) {
  const calls: Array<{ query: string; options: ExaSearchOptions }> = [];
  const search: ExaSearch = async (query, options) => {
    calls.push({ query, options });
    return typeof response === "function" ? response() : response;
  };
  return { search, calls };
}

const context = { topic: "How volcanoes form", names: ["Mauna Loa"], terms: [{ term: "magma", meaning: "molten rock" }] };

describe("getVideoContext", () => {
  it("returns Exa's structured output and asks for the VideoContext schema", async () => {
    const { search, calls } = fakeSearch({ results: [], output: { content: context } });
    expect(await getVideoContext(search, "Volcanoes 101", "A lesson about volcanoes")).toEqual(context);
    const opts = calls[0]!.options;
    expect(opts.type).toBe("auto");
    expect(opts.contents).toEqual({ highlights: true });
    expect(Object.keys((opts.outputSchema as { properties: object }).properties)).toEqual(["topic", "names", "terms"]);
    expect(opts.outputSchema).not.toHaveProperty("$schema");
  });

  it("accepts structured output as a JSON string", async () => {
    const { search } = fakeSearch({ results: [], output: { content: JSON.stringify(context) } });
    expect(await getVideoContext(search, "Volcanoes", "")).toEqual(context);
  });

  it("falls back to highlights when the structured output is invalid", async () => {
    const { search } = fakeSearch({ results: [{ url: "https://a.com", highlights: ["Volcanoes are mountains."] }], output: { content: { nope: 1 } } });
    expect(await getVideoContext(search, "Volcanoes", "")).toEqual({ topic: "Volcanoes are mountains.", names: [], terms: [] });
  });

  it("returns undefined without a key, on errors and on timeout, so glossing continues", async () => {
    expect(await getVideoContext(undefined, "Volcanoes", "")).toBeUndefined();
    const errors: unknown[] = [];
    const failing = fakeSearch(async () => {
      throw new Error("Exa down");
    });
    expect(await getVideoContext(failing.search, "Volcanoes", "", { onError: (e) => errors.push(e) })).toBeUndefined();
    const slow = fakeSearch(() => new Promise((r) => setTimeout(() => r({ results: [], output: { content: context } }), 200)));
    expect(await getVideoContext(slow.search, "Volcanoes", "", { timeoutMs: 20, onError: (e) => errors.push(e) })).toBeUndefined();
    expect(errors).toHaveLength(2);
  });

  it("returns undefined when there is no title to search for", async () => {
    const { search, calls } = fakeSearch({ results: [] });
    expect(await getVideoContext(search, "  ", "")).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("youtubeWatchId", () => {
  it("accepts only youtube.com/watch?v= URLs", () => {
    expect(youtubeWatchId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeWatchId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeWatchId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBeUndefined();
    expect(youtubeWatchId("https://www.youtube.com/@channel")).toBeUndefined();
    expect(youtubeWatchId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeUndefined();
    expect(youtubeWatchId("not a url")).toBeUndefined();
  });
});

describe("discoverVideos", () => {
  it("returns only YouTube /watch results, without duplicates, limited to youtube.com", async () => {
    const { search, calls } = fakeSearch({
      results: [
        { title: "How volcanoes work", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", highlights: ["Magma rises..."] },
        { title: "Same video", url: "https://youtube.com/watch?v=aaaaaaaaaaa&t=5" },
        { title: "A channel", url: "https://www.youtube.com/@volcanoes" },
        { title: "A short", url: "https://www.youtube.com/shorts/bbbbbbbbbbb" },
        { title: null, url: "https://www.youtube.com/watch?v=ccccccccccc" },
      ],
    });
    const out = await discoverVideos(search, "volcanoes");
    expect(calls[0]!.options.includeDomains).toEqual(["youtube.com"]);
    expect(out).toEqual([
      {
        videoId: "aaaaaaaaaaa",
        title: "How volcanoes work",
        url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        snippet: "Magma rises...",
        thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
      },
      {
        videoId: "ccccccccccc",
        title: "Untitled video",
        url: "https://www.youtube.com/watch?v=ccccccccccc",
        snippet: "",
        thumbnail: "https://i.ytimg.com/vi/ccccccccccc/hqdefault.jpg",
      },
    ]);
  });
});

describe("findSignReferences", () => {
  it("returns results only from the allowed ASL sites", async () => {
    const { search, calls } = fakeSearch({
      results: [
        { title: "VOLCANO in ASL", url: "https://www.handspeak.com/word/volcano/", highlights: ["Sign VOLCANO..."] },
        { title: "Spam", url: "https://example.com/volcano" },
        { title: "Volcano", url: "https://www.lifeprint.com/asl101/pages-signs/v/volcano.htm" },
      ],
    });
    const out = await findSignReferences(search, "volcano");
    expect(calls[0]!.query).toBe("how to sign volcano in ASL");
    expect(calls[0]!.options.includeDomains).toEqual(SIGN_REFERENCE_DOMAINS);
    expect(out.map((r) => r.source)).toEqual(["handspeak.com", "lifeprint.com"]);
    expect(out[0]!.highlight).toBe("Sign VOLCANO...");
    expect(out[1]).not.toHaveProperty("highlight");
  });
});

describe("sign-reference relevance and excerpts (R-I8)", () => {
  it("drops near misses that don't mention the word (seen live: 'zzqxv' returned the letter Z)", async () => {
    const { search } = fakeSearch({
      results: [
        { title: "American Sign Language ASL Video Dictionary - zz", url: "https://www.signasl.org/sign/zz" },
        { title: "Z • ASL Dictionary", url: "https://www.handspeak.com/word/2485/" },
      ],
    });
    expect(await findSignReferences(search, "zzqxv")).toEqual([]);
  });

  it("keeps pages that name the word in the title or URL, including multi-word phrases", async () => {
    const { search } = fakeSearch({
      results: [
        { title: "ARRAY • ASL Dictionary", url: "https://www.handspeak.com/word/2202/" },
        { title: "Video Dictionary", url: "https://www.signasl.org/sign/array" },
        { title: "Sign", url: "https://www.signasl.org/sign/thank-you" },
      ],
    });
    expect((await findSignReferences(search, "array")).map((r) => r.url)).toHaveLength(2);
    expect(await findSignReferences(search, "thank you")).toHaveLength(1);
  });

  it("cuts long highlights to a short excerpt at a word boundary", () => {
    const long = "word ".repeat(200);
    const out = excerpt(long)!;
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out.endsWith("…")).toBe(true);
    expect(excerpt("  short\n\n text ")).toBe("short text");
    expect(excerpt(undefined)).toBeUndefined();
  });
});

describe("createExaSearch", () => {
  it("returns undefined without an API key", () => {
    expect(createExaSearch(undefined)).toBeUndefined();
  });
});
