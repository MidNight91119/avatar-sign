import type { ReactNode } from "react";
import { splitAtGloss, type CaptionState } from "./caption";
import { formatClock } from "./youtube";

/** "sign" in Inter Tight + "side" in Instrument Serif italic. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`ss-wordmark ${className}`}>
      sign<em>side</em>
    </span>
  );
}

/**
 * Placeholder avatar (flat SVG from the design) until the real player lands (specs/hasan.md H-I1–H-I4).
 * `signKey` changes on every new sign, which replays a short hand movement; when the video is
 * paused no new sign starts, so the hands stay still.
 */
export function AvatarFigure({ signing, signKey }: { signing: boolean; signKey?: string }) {
  return (
    <svg className="ss-avatar" viewBox="10 40 230 400" aria-hidden="true">
      <defs>
        <linearGradient id="ss-skin" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#EDBE9C" />
          <stop offset="1" stopColor="#C98B63" />
        </linearGradient>
        <linearGradient id="ss-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2A2C" />
          <stop offset="1" stopColor="#121213" />
        </linearGradient>
        <radialGradient id="ss-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <g id="ss-hand">
          <rect x="-12" y="-4" width="24" height="22" rx="10" fill="url(#ss-skin)" />
          <rect x="-12" y="-19" width="5.5" height="18" rx="2.75" fill="url(#ss-skin)" />
          <rect x="-5.5" y="-23" width="5.5" height="22" rx="2.75" fill="url(#ss-skin)" />
          <rect x="1" y="-21" width="5.5" height="20" rx="2.75" fill="url(#ss-skin)" />
          <rect x="7.5" y="-16" width="5" height="16" rx="2.5" fill="url(#ss-skin)" />
          <rect x="10" y="2" width="5" height="14" rx="2.5" transform="rotate(-40 12 9)" fill="url(#ss-skin)" />
        </g>
      </defs>
      <circle cx="125" cy="130" r="110" fill="url(#ss-glow)" />
      <path d="M30 440 L30 230 C30 190 74 172 125 172 C176 172 220 190 220 230 L220 440 Z" fill="url(#ss-top)" />
      <rect x="111" y="142" width="28" height="32" rx="12" fill="url(#ss-skin)" />
      <ellipse cx="125" cy="104" rx="38" ry="45" fill="url(#ss-skin)" />
      <path d="M86 100 C84 64 106 52 126 52 C150 52 168 66 164 100 C158 82 146 74 126 74 C106 74 94 82 86 100 Z" fill="#2A1A12" />
      <circle cx="111" cy="108" r="3.4" fill="#2A1A12" />
      <circle cx="139" cy="108" r="3.4" fill="#2A1A12" />
      <path d="M115 127 Q125 133 135 127" fill="none" stroke="#7A3E22" strokeWidth="2.2" strokeLinecap="round" />
      {signing ? (
        <g key={signKey} className="ss-hands-signing">
          <path d="M66 200 C46 236 62 246 82 214 C90 198 95 180 98 164" fill="none" stroke="url(#ss-top)" strokeWidth="24" strokeLinecap="round" />
          <path d="M184 200 C204 230 196 244 176 226 C168 218 160 212 154 206" fill="none" stroke="url(#ss-top)" strokeWidth="24" strokeLinecap="round" />
          <use href="#ss-hand" transform="translate(98 148) rotate(-8)" />
          <use href="#ss-hand" transform="translate(152 202) rotate(-70)" />
        </g>
      ) : (
        <g>
          <path d="M66 200 C58 236 84 248 112 240" fill="none" stroke="url(#ss-top)" strokeWidth="24" strokeLinecap="round" />
          <path d="M184 200 C192 236 166 248 138 240" fill="none" stroke="url(#ss-top)" strokeWidth="24" strokeLinecap="round" />
          <use href="#ss-hand" transform="translate(116 236) rotate(80) scale(0.95)" />
          <use href="#ss-hand" transform="translate(134 236) rotate(-80) scale(0.95)" />
        </g>
      )}
    </svg>
  );
}

export type PanelMode = "none" | "idle" | "signing";

export interface SignPanelProps {
  /** none: no video found · idle: connected, not signing · signing: following the video. */
  mode: PanelMode;
  /** Big and small text on the card while not signing. */
  head: ReactNode;
  sub: ReactNode;
  /** Source row: "Auto-connected" / "youtube.com/watch?v=…". */
  sourceLabel: string;
  sourceDetail: string;
  langs: readonly string[];
  lang: string;
  onLang?: (lang: string) => void;
  /** Playback speed shown on the chip, e.g. 1 → "1×". The chip is hidden without `onSpeed`. */
  speed?: number;
  onSpeed?: () => void;
  /** Caption and sign at the current media time (signing mode). */
  caption?: CaptionState;
  /** Media time in seconds, shown on the live chip (hidden when undefined). */
  time?: number;
  onToggle?: () => void;
  /** Small logo shown before the wordmark (each host serves its own image). */
  logoSrc?: string;
  /** Extra controls on the right of the header. */
  headerAction?: ReactNode;
  className?: string;
}

/** The signside panel from the design: one component for the extension side panel and the website. */
export function SignPanel(p: SignPanelProps) {
  const signing = p.mode === "signing";
  const [before, word, after] = splitAtGloss(p.caption?.text ?? "", p.caption?.gloss);
  return (
    <section className={`ss-panel ${p.className ?? ""}`} aria-label="Sign language panel">
      <AvatarFigure signing={signing && !!p.caption?.gloss} signKey={`${p.caption?.gloss}@${p.caption?.signStart}`} />

      <header className="ss-glass ss-header">
        {p.logoSrc ? <img src={p.logoSrc} alt="" width={26} height={26} /> : null}
        <Wordmark />
        {p.headerAction}
      </header>

      <div className="ss-toprow">
        <div role="group" aria-label="Sign language" className="ss-glass ss-segmented">
          {p.langs.map((l) => (
            <button key={l} type="button" aria-pressed={l === p.lang} onClick={p.onLang && (() => p.onLang!(l))} disabled={!p.onLang}>
              {l}
            </button>
          ))}
        </div>
        {signing && p.time !== undefined ? (
          <span className="ss-glass ss-chip">
            <span className="ss-dot ss-dot-live" />
            Live {formatClock(p.time)}
          </span>
        ) : null}
      </div>

      <div className="ss-stack">
        <div className="ss-card ss-caption">
          {signing ? (
            <>
              <div className="ss-progress-row">
                <div className="ss-progress" aria-hidden="true">
                  <div style={{ width: `${Math.round((p.caption?.progress ?? 0) * 100)}%` }} />
                </div>
                {p.caption?.gloss ? (
                  <span className="ss-gloss" aria-label={`Signing ${p.caption.gloss}`}>
                    {p.caption.gloss}
                  </span>
                ) : null}
              </div>
              {p.caption?.prev ? <p className="ss-sub">{p.caption.prev}</p> : null}
              <p className="ss-head">
                {p.caption?.text ? (
                  <>
                    {before}
                    {word ? <mark>{word}</mark> : null}
                    {after}
                  </>
                ) : (
                  "Waiting for speech…"
                )}
              </p>
            </>
          ) : (
            <>
              <p className="ss-head">{p.head}</p>
              <p className="ss-sub">{p.sub}</p>
            </>
          )}
        </div>

        <div className="ss-card ss-source">
          <span className="ss-thumb" aria-hidden="true" />
          <span className="ss-source-text">
            <span className="ss-source-label">
              <span className={`ss-dot ss-dot-${p.mode}`} />
              {p.sourceLabel}
            </span>
            <span className="ss-source-detail">{p.sourceDetail}</span>
          </span>
          {p.onSpeed ? (
            <button type="button" className="ss-speed" onClick={p.onSpeed} aria-label={`Playback speed ${p.speed}×, change`}>
              {p.speed}×
            </button>
          ) : null}
        </div>

        {p.mode === "none" ? (
          <button type="button" className="ss-cta ss-cta-waiting" disabled>
            Waiting for a video
            <span className="ss-cta-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        ) : (
          <button type="button" className="ss-cta" onClick={p.onToggle} disabled={!p.onToggle}>
            {signing ? "Stop signing" : "Start sign language"}
            <span className="ss-cta-icon" aria-hidden="true">
              {signing ? (
                <span className="ss-stop" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              )}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
