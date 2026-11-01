# @signstream/sign-assets

Hasan's supported ASL inventory for the procedural player. There are no clip or
model downloads in this MVP. `dictionary.json` retains the PLAN §4.5 object shape:

- `signs`: uppercase keys, using hyphens for multi-word signs. Each value is an
  explicit `procedural:<engine sign>` identifier for an existing player definition.
- `letters`: A–Z and 0–9, with `procedural:FS:<character>` identifiers.

These are engine locators, not file paths or URLs. The API consumes sign keys;
the player resolves them through its own lexicon. Do not advertise fake clip files.
Zero currently fingerspells ZERO; 1–9 use existing numeric-word poses. Number
strings play digit by digit inside the allocated slot. Human readability and
compound-number grammar are not established by inventory registration.

Regenerate from the repository root:

```sh
bun packages/player/src/sync-dictionary.ts
bun test packages/player
```

The dictionary tests ensure exact agreement with `knownSigns()`, canonical keys,
resolvable locators and finite letter/digit poses. After any vocabulary change,
refresh API/extension caches before measuring coverage or demonstrating playback.
