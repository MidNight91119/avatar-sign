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

export type PanelMode = "none" | "idle" | "signing";

export interface SignPanelProps {
  /** none: no video found · idle: connected, not signing · signing: following the video. */
  mode: PanelMode;
  /** The signer, drawn behind the panel's glass cards: usually `<AvatarCanvas>` from `@repo/ui/avatar-canvas`. */
  avatar?: ReactNode;
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
      <div className="ss-avatar-layer">{p.avatar}</div>

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
