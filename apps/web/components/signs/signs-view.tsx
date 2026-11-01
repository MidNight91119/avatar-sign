"use client";

import { useState, type FormEvent } from "react";
import type { SignReference } from "@signstream/shared";
import { knownSigns, unitsFor } from "@signstream/player";
import { AvatarCanvas } from "@repo/ui/avatar-canvas";
import { SignPanel } from "@repo/ui/sign-panel";
import { api, apiUrl } from "../../lib/api";

interface Refs {
  word: string;
  items?: SignReference[];
  error?: boolean;
}

/** Every word the avatar signs (ASL). Anything else is fingerspelled. */
const SIGNS = knownSigns();

/** /signs: browse and search the avatar's signs; unknown words are fingerspelled, with Exa "how to sign it" links. */
export function SignsView() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ gloss: string; key: number }>();
  const [refs, setRefs] = useState<Refs>();

  const q = query.trim().toUpperCase();
  const shown = SIGNS.filter((g) => g.includes(q));
  const play = (gloss: string) => setSelected({ gloss, key: Date.now() });

  // References only on submit, never per keystroke: each lookup can cost an Exa call.
  function onSearch(e: FormEvent) {
    e.preventDefault();
    const word = q.replace(/[^A-Z' -]/g, "").trim();
    if (!word) return;
    const units = unitsFor(word);
    if (units.length && units.every((u) => "sign" in u)) {
      setRefs(undefined);
      return play(word);
    }
    play(`FS:${word}`);
    setRefs({ word });
    api.signReference(word.toLowerCase()).then(
      (items) => setRefs((r) => (r?.word === word ? { word, items } : r)),
      () => setRefs((r) => (r?.word === word ? { word, error: true } : r)),
    );
  }

  const fs = selected?.gloss.startsWith("FS:") ? selected.gloss.slice(3).split("").join("-") : undefined;

  return (
    <div className="signs">
      <div className="signs-main">
        <form role="search" className="link-form" onSubmit={onSearch}>
          <label htmlFor="sign-search" className="visually-hidden">
            Search signs
          </label>
          <input
            id="sign-search"
            type="search"
            placeholder="Search a word, e.g. volcano"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit">Sign it</button>
        </form>

        {refs ? (
          <section className="refs" aria-live="polite">
            <h2>“{refs.word.toLowerCase()}” isn&apos;t in the library yet</h2>
            <p>The avatar fingerspells it. To learn the real sign:</p>
            {refs.items ? (
              refs.items.length ? (
                <ul>
                  {refs.items.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.title}
                      </a>{" "}
                      <span>{r.source}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No how-to-sign pages found for this word.</p>
              )
            ) : refs.error ? (
              <p>Couldn&apos;t load the links right now. Try again in a minute.</p>
            ) : (
              <p>Finding how-to-sign pages…</p>
            )}
            <p className="refs-note">How-to-sign links found with Exa{apiUrl ? "" : " (demo data)"}.</p>
          </section>
        ) : null}

        <p className="signs-count" aria-live="polite">
          {shown.length} of {SIGNS.length} signs
        </p>
        <ul className="sign-grid">
          {shown.map((g) => (
            <li key={g}>
              <button type="button" aria-pressed={selected?.gloss === g} onClick={() => play(g)}>
                {g}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="signs-panel">
        <SignPanel
          mode={selected ? "signing" : "idle"}
          avatar={<AvatarCanvas sign={selected} />}
          logoSrc="/brand/hand.png"
          langs={["ASL"]}
          lang="ASL"
          head="Pick a sign."
          sub="Click any sign to see it, or type a word and press Sign it."
          sourceLabel="ASL sign library"
          sourceDetail={`${SIGNS.length} signs + A–Z fingerspelling`}
          caption={
            selected
              ? { text: fs ? `Fingerspelled: ${fs}` : selected.gloss, gloss: selected.gloss, signStart: selected.key, progress: 1 }
              : undefined
          }
          onToggle={selected ? () => setSelected(undefined) : () => play("HELLO")}
        />
      </div>
    </div>
  );
}
