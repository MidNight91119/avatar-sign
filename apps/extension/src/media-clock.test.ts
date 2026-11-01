import { expect, test } from "bun:test";
import { isClockMessage, mediaTimeAt } from "./media-clock";

test("extrapolates a playing video's time from the last report", () => {
  expect(mediaTimeAt({ t: 10, rate: 1, paused: false, at: 1000 }, 1250)).toBeCloseTo(10.25);
  expect(mediaTimeAt({ t: 10, rate: 2, paused: false, at: 1000 }, 1250)).toBeCloseTo(10.5);
});

test("a paused video stays put", () => {
  expect(mediaTimeAt({ t: 10, rate: 1, paused: true, at: 1000 }, 5000)).toBe(10);
});

test("never runs more than a second ahead when reports stop", () => {
  expect(mediaTimeAt({ t: 10, rate: 1, paused: false, at: 1000 }, 60_000)).toBe(11);
  expect(mediaTimeAt({ t: 10, rate: 1, paused: false, at: 1000 }, 500)).toBe(10);
});

test("only well-formed clock messages are accepted", () => {
  expect(isClockMessage({ type: "signside:time", t: 1, rate: 1, paused: false })).toBe(true);
  expect(isClockMessage({ type: "signside:time", t: "1", rate: 1, paused: false })).toBe(false);
  expect(isClockMessage({ type: "signside:time", t: 1, rate: 1 })).toBe(false);
  expect(isClockMessage({ type: "other", t: 1, rate: 1, paused: false })).toBe(false);
  expect(isClockMessage(null)).toBe(false);
});
