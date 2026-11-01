import { expect, it } from "bun:test";
import { createRateLimiter } from "./rate-limit";

it("allows `limit` hits per window per key, then resets", () => {
  let t = 0;
  const rl = createRateLimiter(2, 1000, () => t);
  expect([rl.hit("a"), rl.hit("a"), rl.hit("a")]).toEqual([true, true, false]);
  expect(rl.hit("b")).toBe(true);
  expect(rl.remaining("a")).toBe(0);
  t = 1000;
  expect(rl.hit("a")).toBe(true);
  expect(rl.remaining("a")).toBe(1);
});
