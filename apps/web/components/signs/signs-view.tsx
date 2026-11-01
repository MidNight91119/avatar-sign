"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SIGN_LANGS, type SignLang, type SignReference } from "@signstream/shared";
import { SignPanel } from "@repo/ui/sign-panel";
import { api, apiUrl } from "../../lib/api";

interface Refs {
  word: string;
  items?: SignReference[];
  error?: boolean;
}

export function SignsView() {
  const [lang, setLang] = useState<SignLang>("ASL");
  const [signs, setSigns] = useState<{ lang: SignLang; list?: string[]; error?: boolean }>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ gloss: string; at: number }>();
  const [refs, setRefs] = useState<Refs>();

  useEffect(() => {
    const ctrl = new AbortController();
    api.getSigns(lang, ctrl.signal).then(
      (list) => setSigns({ lang, list }),
      () => !ctrl.signal.aborted && setSigns({ lang, error: true }),
    );
    return () => ctrl.abort();
  }, [lang]);

  const list = signs?.lang === lang ? signs.list : undefined;
  const q = query.trim().toUpperCase();
  const shown = list?.filter((g) => g.includes(q));
  const play = (gloss: string) => setSelected({ gloss, at: Date.now() });

  // References only on submit, never per keystroke: each lookup can cost an Exa call.
  function onSearch(e: FormEvent) {
    e.preventDefault();
    const word = q.replace(/[^A-Z0-9'-]/g, "");
    if (!word) return;
    if (list?.includes(word)) return play(word);
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
          <button type="submit">Find</button>
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

        {signs?.error && signs.lang === lang ? (
          <p role="alert">Couldn&apos;t load the sign list. Check your connection and reload.</p>
        ) : !shown ? (
          <p>Loading signs…</p>
        ) : list!.length === 0 ? (
          <p>No {lang} signs yet: everything is fingerspelled for now.</p>
        ) : (
          <>
            <p className="signs-count" aria-live="polite">
              {shown.length} of {list!.length} signs{apiUrl ? "" : " (demo list)"}
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
          </>
        )}
      </div>

      <div className="signs-panel">
        <SignPanel
          mode={selected ? "signing" : "idle"}
          logoSrc="/brand/hand.png"
          langs={SIGN_LANGS}
          lang={lang}
          onLang={(l) => setLang(l as SignLang)}
          head="Pick a sign."
          sub="Click any sign to see it, or search for a word."
          sourceLabel={`${lang} sign library`}
          sourceDetail={list ? `${list.length} signs + fingerspelling` : "Loading…"}
          caption={
            selected
              ? { text: fs ? `Fingerspelled: ${fs}` : selected.gloss, gloss: selected.gloss, signStart: selected.at, progress: 1 }
              : undefined
          }
          onToggle={selected ? () => setSelected(undefined) : list?.[0] ? () => play(list[0]!) : undefined}
        />
        <p className="signs-panel-note">Preview avatar: the 3D signer replaces it once the first clips land.</p>
      </div>
    </div>
  );
}
