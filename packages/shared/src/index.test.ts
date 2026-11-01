import { expect, it } from "bun:test";
import { SIGN_LANGS } from "./index";

it("supports ASL first", () => {
  expect(SIGN_LANGS[0]).toBe("ASL");
});
