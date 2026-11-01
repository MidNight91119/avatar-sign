import { knownSigns } from "./timeline";

/** Procedural locators identify existing engine definitions; they are not clip URLs. */
export function proceduralDictionary() {
  return {
    lang: "ASL",
    signs: Object.fromEntries(knownSigns().map(sign => [sign.replaceAll(" ", "-"), `procedural:${sign}`])),
    letters: Object.fromEntries([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].map(character => [character, `procedural:FS:${character}`])),
  };
}

if (import.meta.main) {
  const file = new URL("../../sign-assets/dictionary.json", import.meta.url);
  await Bun.write(file, JSON.stringify(proceduralDictionary(), null, 2) + "\n");
}
