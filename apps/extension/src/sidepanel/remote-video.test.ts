import { describe, expect, it } from "bun:test";
import { createVideoSync } from "../avatar/sync";
import type { VideoSnapshot } from "../messages";
import { RemoteVideo } from "./remote-video";

const snap = (patch: Partial<VideoSnapshot> = {}): VideoSnapshot => ({
  event: "sync",
  currentTime: 0,
  paused: true,
  buffering: false,
  playbackRate: 1,
  adShowing: false,
  sentAt: 1_000,
  ...patch,
});

function setup() {
  let now = 0;
  const remote = new RemoteVideo(() => now);
  const events: string[] = [];
  for (const type of ["play", "pause", "seeked", "ratechange", "adchange", "waiting", "playing"]) {
    remote.addEventListener(type, () => events.push(type));
  }
  return { remote, events, advance: (ms: number) => (now += ms) };
}

describe("RemoteVideo", () => {
  it("runs the clock between updates while playing, at the playback rate", () => {
    const { remote, advance } = setup();
    remote.apply(snap({ currentTime: 10, paused: false }), 1_000);
    advance(500);
    expect(remote.currentTime).toBeCloseTo(10.5);
    remote.apply(snap({ currentTime: 10.5, paused: false, playbackRate: 2 }), 1_000);
    advance(250);
    expect(remote.currentTime).toBeCloseTo(11);
  });

  it("holds still while paused", () => {
    const { remote, advance } = setup();
    remote.apply(snap({ currentTime: 30, paused: true }), 1_000);
    advance(2_000);
    expect(remote.currentTime).toBe(30);
  });

  it("corrects for message latency", () => {
    const { remote } = setup();
    remote.apply(snap({ currentTime: 10, paused: false, sentAt: 1_000 }), 1_100);
    expect(remote.currentTime).toBeCloseTo(10.1);
  });

  it("fires the same events as a <video>, only when something changed", () => {
    const { remote, events } = setup();
    remote.apply(snap({ paused: false }));
    remote.apply(snap({ paused: false })); // timeupdate: nothing new
    remote.apply(snap({ paused: false, playbackRate: 1.5 }));
    remote.apply(snap({ paused: false, playbackRate: 1.5, event: "seeked", currentTime: 90 }));
    remote.apply(snap({ paused: false, playbackRate: 1.5, adShowing: true }));
    remote.apply(snap({ paused: true, playbackRate: 1.5, adShowing: true }));
    expect(events).toEqual(["play", "ratechange", "seeked", "adchange", "pause"]);
  });

  it("drives createVideoSync like a real video", () => {
    const { remote, advance } = setup();
    const ticks: number[] = [];
    const calls: string[] = [];
    let frame: (() => void) | undefined;
    createVideoSync({
      video: remote.asMedia(),
      player: {
        tick: (t) => void ticks.push(Math.round(t * 10) / 10),
        play: () => void calls.push("play"),
        pause: () => void calls.push("pause"),
        setSpeed: (r) => void calls.push(`speed:${r}`),
      },
      getOffset: () => 0,
      isSuspended: () => remote.adShowing,
      requestFrame: (cb) => {
        frame = cb;
        return 1;
      },
    });
    remote.apply(snap({ currentTime: 5, paused: false }), 1_000);
    advance(1_000);
    frame?.();
    remote.apply(snap({ currentTime: 60, paused: true, event: "seeked" }), 1_000);
    expect(calls).toContain("play");
    expect(calls.at(-1)).toBe("pause");
    expect(ticks).toContain(6);
    expect(ticks.at(-1)).toBe(60);
  });

  it("resets when the tab leaves the video", () => {
    const { remote } = setup();
    remote.apply(snap({ currentTime: 50, paused: false, adShowing: true }));
    remote.reset();
    expect(remote.paused).toBe(true);
    expect(remote.adShowing).toBe(false);
    expect(remote.currentTime).toBe(0);
  });

  it("holds the clock while YouTube buffers, and says so", () => {
    const { remote, events, advance } = setup();
    remote.apply(snap({ currentTime: 20, paused: false }), 1_000);
    remote.apply(snap({ event: "waiting", currentTime: 20.2, paused: false, buffering: true }), 1_000);
    advance(3_000);
    expect(remote.currentTime).toBeCloseTo(20.2);
    remote.apply(snap({ event: "playing", currentTime: 20.2, paused: false }), 1_000);
    advance(500);
    expect(remote.currentTime).toBeCloseTo(20.7);
    expect(events).toEqual(["play", "waiting", "playing"]);
  });
});
