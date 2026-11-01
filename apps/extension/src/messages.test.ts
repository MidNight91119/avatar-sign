import { describe, expect, it } from "bun:test";
import { sampleTrack } from "../test/fixtures";
import { SidePanelUpdateSchema, SignTrackRequestSchema, SignTrackUpdateSchema } from "./messages";

describe("message schemas", () => {
  it("accept a valid track request and reject anything else", () => {
    const ok = { type: "request", requestId: "r1", videoId: "dQw4w9WgXcQ", lang: "ASL" };
    expect(SignTrackRequestSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, videoId: "https://evil.example/" }, // not a YouTube id: can't be used to reach another URL
      { ...ok, videoId: "short" },
      { ...ok, lang: "BSL" },
      { ...ok, type: "fetch" },
      { ...ok, requestId: "" },
      null,
    ]) {
      expect(SignTrackRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("validate track updates with the shared SignTrack schema", () => {
    const track = sampleTrack();
    expect(SignTrackUpdateSchema.safeParse({ type: "ready", requestId: "r1", track, source: "cache" }).success).toBe(true);
    expect(SignTrackUpdateSchema.safeParse({ type: "progress", requestId: "r1", progress: 0.5 }).success).toBe(true);
    expect(SignTrackUpdateSchema.safeParse({ type: "error", requestId: "r1", code: "NO_CAPTIONS" }).success).toBe(true);

    const broken = { ...track, segments: [{ start: 0, end: 1, text: "hi", signs: [{ gloss: "", start: 0, duration: 1 }] }] };
    expect(SignTrackUpdateSchema.safeParse({ type: "ready", requestId: "r1", track: broken, source: "api" }).success).toBe(false);
    expect(SignTrackUpdateSchema.safeParse({ type: "ready", requestId: "r1", track, source: "somewhere" }).success).toBe(false);
    expect(SignTrackUpdateSchema.safeParse({ type: "progress", requestId: "r1", progress: 2 }).success).toBe(false);
  });

  it("validate what the content script sends the side panel", () => {
    const video = { event: "seeked", currentTime: 42, paused: true, playbackRate: 1, adShowing: false, sentAt: 1 };
    expect(SidePanelUpdateSchema.safeParse({ type: "video", video }).success).toBe(true);
    expect(SidePanelUpdateSchema.safeParse({ type: "video", video: { ...video, currentTime: -1 } }).success).toBe(false);
    expect(
      SidePanelUpdateSchema.safeParse({ type: "page", page: { route: { kind: "watch", videoId: "dQw4w9WgXcQ" }, title: "x" } }).success,
    ).toBe(true);
    expect(
      SidePanelUpdateSchema.safeParse({ type: "page", page: { route: { kind: "watch", videoId: "../../x" }, title: "x" } }).success,
    ).toBe(false);
  });
});
