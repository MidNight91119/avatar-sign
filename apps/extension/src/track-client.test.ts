import { describe, expect, it } from "bun:test";
import { sampleTrack } from "../test/fixtures";
import { SignTrackRequestSchema, type SignTrackRequest } from "./messages";
import { createTrackClient, type TrackHandlers } from "./track-client";

/** A fake chrome.runtime.Port pair: the test plays the background worker. */
function fakeRuntime() {
  const ports: {
    sent: unknown[];
    deliver(msg: unknown): void;
    drop(): void;
    disconnectedByClient: boolean;
  }[] = [];
  let alive = true;
  const connect = () => {
    const onMessage = new Set<(msg: unknown) => void>();
    const onDisconnect = new Set<() => void>();
    const record = {
      sent: [] as unknown[],
      deliver: (msg: unknown) => onMessage.forEach((fn) => fn(msg)),
      drop: () => onDisconnect.forEach((fn) => fn()),
      disconnectedByClient: false,
    };
    ports.push(record);
    return {
      postMessage: (msg: unknown) => void record.sent.push(msg),
      disconnect: () => void (record.disconnectedByClient = true),
      onMessage: { addListener: (fn: (msg: unknown) => void) => void onMessage.add(fn) },
      onDisconnect: { addListener: (fn: () => void) => void onDisconnect.add(fn) },
    } as unknown as chrome.runtime.Port;
  };
  return { ports, connect, isAlive: () => alive, kill: () => (alive = false) };
}

function recorder() {
  const events: string[] = [];
  const handlers: TrackHandlers = {
    onProgress: (p) => events.push(`progress:${p}`),
    onPartial: (track) => events.push(`partial:${track.segments.length}`),
    onReady: (track, source) => events.push(`ready:${track.videoId}:${source}`),
    onError: (code) => events.push(`error:${code}`),
  };
  return { events, handlers };
}

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const requestOf = (port: { sent: unknown[] }) => SignTrackRequestSchema.parse(port.sent[0]) as SignTrackRequest;

describe("createTrackClient", () => {
  it("sends a validated request and reports progress, then the ready track", () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    const req = requestOf(rt.ports[0]!);
    expect(req).toMatchObject({ type: "request", videoId: "dQw4w9WgXcQ", lang: "ASL" });

    rt.ports[0]!.deliver({ type: "progress", requestId: req.requestId, progress: 0.4 });
    rt.ports[0]!.deliver({ type: "ready", requestId: req.requestId, track: sampleTrack(), source: "api" });
    expect(events).toEqual(["progress:0.4", "ready:dQw4w9WgXcQ:api"]);
    expect(rt.ports[0]!.disconnectedByClient).toBe(true);
  });

  it("ignores invalid payloads and updates for another request", () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    const { requestId } = requestOf(rt.ports[0]!);

    rt.ports[0]!.deliver({ type: "ready", requestId: "someone-else", track: sampleTrack(), source: "api" });
    rt.ports[0]!.deliver({ type: "ready", requestId, track: { segments: "nope" }, source: "api" });
    rt.ports[0]!.deliver({ type: "progress", requestId, progress: 7 });
    rt.ports[0]!.deliver("not even an object");
    expect(events).toEqual([]);
  });

  it("reconnects and asks again when the worker drops the port mid-request (suspension)", async () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    const first = requestOf(rt.ports[0]!);

    rt.ports[0]!.deliver({ type: "progress", requestId: first.requestId, progress: 0.3 });
    rt.ports[0]!.drop(); // worker suspended
    await tick();
    expect(rt.ports.length).toBe(2);
    const second = requestOf(rt.ports[1]!);
    expect(second).toEqual(first); // same request identity

    // A late message on the dead port is ignored; the new port's answer is used.
    rt.ports[0]!.deliver({ type: "ready", requestId: first.requestId, track: sampleTrack("AAAAAAAAAAA"), source: "api" });
    rt.ports[1]!.deliver({ type: "ready", requestId: second.requestId, track: sampleTrack(), source: "api" });
    expect(events).toEqual(["progress:0.3", "ready:dQw4w9WgXcQ:api"]);
  });

  it("gives up after a few reconnects with a useful error", async () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1, maxReconnects: 2 })("dQw4w9WgXcQ", "ASL", handlers);
    for (let i = 0; i < 3; i++) {
      rt.ports.at(-1)!.drop();
      await tick();
    }
    expect(rt.ports.length).toBe(3);
    expect(events).toEqual(["error:WORKER_LOST"]);
  });

  it("reports EXTENSION_RELOADED instead of reconnecting when the extension was reloaded", async () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    rt.kill();
    rt.ports[0]!.drop();
    await tick();
    expect(rt.ports.length).toBe(1);
    expect(events).toEqual(["error:EXTENSION_RELOADED"]);
  });

  it("cancel (leaving the video) disconnects and never reconnects or reports", async () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    const cancel = createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    const { requestId } = requestOf(rt.ports[0]!);
    cancel();
    expect(rt.ports[0]!.disconnectedByClient).toBe(true);
    rt.ports[0]!.drop();
    rt.ports[0]!.deliver({ type: "ready", requestId, track: sampleTrack(), source: "api" });
    await tick();
    expect(rt.ports.length).toBe(1);
    expect(events).toEqual([]);
  });

  it("passes partial snapshots through until the ready track arrives", () => {
    const rt = fakeRuntime();
    const { events, handlers } = recorder();
    createTrackClient({ ...rt, reconnectDelayMs: 1 })("dQw4w9WgXcQ", "ASL", handlers);
    const { requestId } = requestOf(rt.ports[0]!);
    const full = sampleTrack();
    const partial = (n: number) => ({ ...full, status: "processing", segments: full.segments.slice(0, n) });
    rt.ports[0]!.deliver({ type: "partial", requestId, track: partial(2) });
    rt.ports[0]!.deliver({ type: "partial", requestId, track: partial(5) });
    rt.ports[0]!.deliver({ type: "ready", requestId, track: full, source: "api" });
    expect(events).toEqual(["partial:2", "partial:5", `ready:dQw4w9WgXcQ:api`]);
  });
});
