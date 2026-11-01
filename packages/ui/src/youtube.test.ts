import { expect, test } from "bun:test";
import { formatClock, parseVideoId } from "./youtube";

test("parseVideoId accepts the links people paste", () => {
  for (const input of [
    "WgX8e_O7eG8",
    "https://www.youtube.com/watch?v=WgX8e_O7eG8",
    "https://youtube.com/watch?v=WgX8e_O7eG8&t=42s&list=PL123",
    "youtube.com/watch?v=WgX8e_O7eG8",
    "https://m.youtube.com/watch?v=WgX8e_O7eG8",
    "https://youtu.be/WgX8e_O7eG8?si=abc",
    "https://www.youtube-nocookie.com/embed/WgX8e_O7eG8",
    "  https://www.youtube.com/embed/WgX8e_O7eG8  ",
  ]) {
    expect(parseVideoId(input)).toBe("WgX8e_O7eG8");
  }
});

test("parseVideoId rejects anything else", () => {
  for (const input of [
    "",
    "hello",
    "https://vimeo.com/123456789",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/results?search_query=volcano",
    "https://evil.com/watch?v=WgX8e_O7eG8",
    "https://youtube.com.evil.com/watch?v=WgX8e_O7eG8",
    "http://[bad",
  ]) {
    expect(parseVideoId(input)).toBeNull();
  }
});

test("formatClock", () => {
  expect(formatClock(0)).toBe("00:00");
  expect(formatClock(75.9)).toBe("01:15");
  expect(formatClock(-3)).toBe("00:00");
});
