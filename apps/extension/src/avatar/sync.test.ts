import { describe, expect, it } from "bun:test";
import { createVideoSync, type MediaLike } from "./sync";

class FakeVideo extends EventTarget {
  currentTime = 0;
  playbackRate = 1;
  paused = true;
  readyState = 4;
  emit(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

function setup({ suspended = false, offset = 0 } = {}) {
  const video = new FakeVideo();
  const calls: string[] = [];
  const ticks: number[] = [];
  const player = {
    tick: (t: number) => void ticks.push(t),
    play: () => void calls.push("play"),
    pause: () => void calls.push("pause"),
    setSpeed: (rate: number) => void calls.push(`speed:${rate}`),
  };
  const state = { suspended, offset };
  let frames: (() => void)[] = [];
  let cancelled = 0;
  const sync = createVideoSync({
    video: video as unknown as MediaLike,
    player,
    getOffset: () => state.offset,
    isSuspended: () => state.suspended,
    requestFrame: (cb) => frames.push(cb),
    cancelFrame: () => void cancelled++,
  });
  /** Runs one animation frame. */
  const frame = () => {
    const pending = frames;
    frames = [];
    for (const cb of pending) cb();
  };
  calls.length = 0; // ignore the initial state sync
  return { video, sync, player, calls, ticks, state, frame, cancelledCount: () => cancelled };
}

describe("createVideoSync", () => {
  it("applies the video's state when it starts", () => {
    const video = new FakeVideo();
    video.paused = false;
    video.playbackRate = 1.5;
    const calls: string[] = [];
    createVideoSync({
      video: video as unknown as MediaLike,
      player: { tick() {}, play: () => calls.push("play"), pause: () => calls.push("pause"), setSpeed: (r) => calls.push(`speed:${r}`) },
      getOffset: () => 0,
      isSuspended: () => false,
      requestFrame: () => 0,
    });
    expect(calls).toEqual(["speed:1.5", "play"]);
  });

  it("ticks the player with the video time every frame", () => {
    const { video, ticks, frame } = setup();
    video.currentTime = 12.5;
    frame();
    video.currentTime = 12.53;
    frame();
    expect(ticks).toEqual([12.5, 12.53]);
  });

  it("adds the timing offset, never going below zero", () => {
    const { video, ticks, frame, state } = setup({ offset: 0.5 });
    video.currentTime = 10;
    frame();
    state.offset = -1;
    video.currentTime = 0.4;
    frame();
    expect(ticks).toEqual([10.5, 0]);
  });

  it("forwards play, pause and playback speed", () => {
    const { video, calls } = setup();
    video.paused = false; // a real <video> flips paused before firing play/pause
    video.emit("play");
    video.paused = true;
    video.emit("pause");
    video.playbackRate = 2;
    video.emit("ratechange");
    video.playbackRate = 0.5;
    video.emit("ratechange");
    expect(calls).toEqual(["speed:1", "play", "pause", "speed:2", "speed:0.5"]);
  });

  it("jumps straight to the new time on seek, without waiting for a frame", () => {
    const { video, ticks } = setup();
    video.currentTime = 95;
    video.emit("seeking");
    video.currentTime = 30;
    video.emit("seeked");
    expect(ticks).toEqual([95, 30]);
  });

  it("doesn't move the avatar while suspended (ad playing)", () => {
    const { video, ticks, calls, frame, state, sync } = setup({ suspended: true });
    video.currentTime = 3; // ad time
    frame();
    video.emit("play");
    video.emit("seeked");
    expect(ticks).toEqual([]);
    expect(calls).not.toContain("play");

    state.suspended = false; // ad over
    video.paused = false;
    video.currentTime = 42;
    sync.refresh();
    expect(ticks).toEqual([42]);
    expect(calls).toContain("play");
  });

  it("removes every listener and stops the loop on destroy", () => {
    const { video, sync, calls, ticks, frame, cancelledCount } = setup();
    sync.destroy();
    video.emit("play");
    video.emit("seeked");
    video.emit("ratechange");
    expect(calls).toEqual([]);
    expect(ticks).toEqual([]);
    expect(cancelledCount()).toBe(1);
    frame(); // even if a queued frame still fires, it does nothing
    expect(ticks).toEqual([]);
  });

  it("freezes while buffering and resumes when media plays again", () => {
    const { video, calls, frame, ticks } = setup();
    video.paused = false;
    video.emit("play");
    calls.length = 0;
    video.emit("waiting");
    expect(calls).toEqual(["pause"]);
    video.emit("playing");
    expect(calls).toEqual(["pause", "speed:1", "play"]);
    video.currentTime = 7;
    frame();
    expect(ticks.at(-1)).toBe(7);
  });

  it("only treats 'stalled' as buffering when playback can't continue", () => {
    const { video, calls } = setup();
    video.paused = false;
    video.emit("play");
    calls.length = 0;
    video.readyState = 4; // network stalled, but enough is buffered
    video.emit("stalled");
    expect(calls).toEqual([]);
    video.readyState = 2;
    video.emit("stalled");
    expect(calls).toEqual(["pause"]);
  });

  it("re-samples the clock when the tab becomes visible again", () => {
    const video = new FakeVideo();
    const visibility = Object.assign(new EventTarget(), { visibilityState: "hidden" }) as unknown as Document;
    const ticks: number[] = [];
    createVideoSync({
      video: video as unknown as MediaLike,
      player: { tick: (t) => void ticks.push(t), play() {}, pause() {}, setSpeed() {} },
      getOffset: () => 0,
      isSuspended: () => false,
      requestFrame: () => 0,
      visibility,
    });
    video.currentTime = 33;
    (visibility as unknown as { visibilityState: string }).visibilityState = "visible";
    visibility.dispatchEvent(new Event("visibilitychange"));
    expect(ticks).toEqual([33]);
  });

  it("follows a replaced <video> element and ignores the old one", () => {
    const { video: oldVideo, sync, calls, ticks } = setup();
    const next = new FakeVideo();
    next.currentTime = 12;
    sync.setVideo(next as unknown as MediaLike);
    expect(ticks.at(-1)).toBe(12);
    calls.length = 0;
    oldVideo.emit("ratechange");
    expect(calls).toEqual([]);
    next.playbackRate = 1.5;
    next.emit("ratechange");
    expect(calls).toEqual(["speed:1.5"]);
  });
});
