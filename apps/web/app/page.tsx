import Link from "next/link";
import { SignPanel } from "@repo/ui/sign-panel";
import { LinkForm } from "../components/link-form";
import s from "../components/landing/landing.module.css";

const ArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const steps = [
  { title: "Open a YouTube video", body: "The extension spots it and connects on its own. Or paste a link on this site.", art: "linear-gradient(90deg, #F3C6C4, #FF7A2E)" },
  { title: "Pick ASL", body: "Slow the video down any time; the signing follows it.", art: "linear-gradient(90deg, #CFC4F2, #F3C6C4)" },
  { title: "Press start", body: "The avatar signs each sentence as the video plays, right beside it.", art: "linear-gradient(90deg, #EFCF86, #F3BE68)" },
];

const people = [
  { who: "Deaf people who sign first", why: "Watch lectures, news and tutorials in the language you think in.", dot: "linear-gradient(135deg, #FF7A2E, #F3C6C4)" },
  { who: "Deaf students", why: "Online classes are mostly video. Follow them without waiting for an interpreter.", dot: "linear-gradient(135deg, #CFC4F2, #F3C6C4)" },
  { who: "Hard-of-hearing people", why: "Use signing, captions, or both: whatever is easiest that day.", dot: "linear-gradient(135deg, #EFCF86, #F3BE68)" },
  { who: "Families and teachers", why: "Share any video with a Deaf child or student, and learn signs alongside them.", dot: "linear-gradient(135deg, #F3C6C4, #E07A62)" },
  { who: "Creators and schools", why: "Point viewers to signside to make your videos more accessible.", dot: "linear-gradient(135deg, #BFD3F5, #CFC4F2)" },
];

export default function Home() {
  return (
    <main>
      <header className={s.hero}>
        <div className={s.heroStage}>
          <div className={s.heroVideo} aria-hidden="true">
            <span className={s.badge}>
              <span className={s.greenDot} />
              Connected automatically
            </span>
            <span className={s.play}>
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M7 4.5v15l12.5-7.5z" fill="#fff" />
              </svg>
            </span>
            <span className={s.subtitle}>That&apos;s why reading from it is fast.</span>
          </div>
          {/* A still of the panel, for show: not interactive. */}
          <div className={s.heroPanel} aria-hidden="true" inert>
            <div>
              <SignPanel
                mode="signing"
                langs={["ASL", "ISL"]}
                lang="ASL"
                head=""
                sub=""
                sourceLabel="Signing in ASL"
                sourceDetail="youtube.com/watch?v=WgX8e_O7eG8"
                caption={{
                  prev: "…so the cache sits right next to the core.",
                  text: "That's why reading from it is fast.",
                  gloss: "FAST",
                  progress: 0.34,
                }}
                time={252}
                logoSrc="/brand/hand.png"
              />
            </div>
          </div>
        </div>

        <div className={s.intro}>
          <div className={s.introMain}>
            <h1 className={s.h1}>
              Every video online, now in <span className="serif">sign language</span>
            </h1>
            <p className={s.chips}>
              <span className={s.chipsLabel}>Signs along with</span>
              {["Lectures", "News", "Tutorials", "Explainers"].map((c) => (
                <span key={c} className={s.chip}>
                  {c}
                </span>
              ))}
            </p>
          </div>
          <div className={s.introSide}>
            <p className={s.lede}>
              A Chrome extension and website for Deaf people. Open a YouTube video and an avatar signs it as it plays: in ASL
              today, with ISL next.
            </p>
            <LinkForm id="link-top" />
          </div>
        </div>
      </header>

      <div className={s.haze} aria-hidden="true" />

      <section className={s.aim} aria-labelledby="aim-title">
        <div className={s.aimMain}>
          <span className="eyebrow">The aim</span>
          <h2 id="aim-title" className={`${s.h2Light} ${s.reveal}`}>
            Captions give you words. <span className="accent">Signing gives you the language.</span>
          </h2>
          <p className={s.ink}>
            For many Deaf people, sign language is their first language and written English or Hindi is a second one. Captions
            ask them to read fast, in that second language. Almost no video online comes with a signer, so we put one beside
            every video.
          </p>
          <a href="#why" aria-label="Read why signing helps" className={s.arrow}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </div>
        <dl className={s.stats}>
          <div className={`${s.stat} ${s.reveal}`}>
            <dt>Deaf people in signing communities, worldwide</dt>
            <dd>70M+</dd>
          </div>
          <div className={`${s.stat} ${s.reveal} ${s.d2}`}>
            <dt>Deaf people in India (Census 2011)</dt>
            <dd>~50 lakh</dd>
          </div>
          <div className={`${s.stat} ${s.reveal} ${s.d3}`}>
            <dt>Certified ISL interpreters for all of them</dt>
            <dd>&lt;300</dd>
          </div>
        </dl>
      </section>

      <section id="why" className={s.why} aria-labelledby="why-title">
        <div className={s.row}>
          <div className={`${s.card} ${s.cardWide} ${s.langsCard} ${s.reveal}`}>
            <ul className={s.langList} aria-label="Sign languages">
              <li>
                ASL <span>(American)</span>
              </li>
              <li>
                ISL <span>(Indian, next)</span>
              </li>
            </ul>
            <div className={s.langsText}>
              <h3 className={s.cardTitle}>Your first language</h3>
              <p className={s.cardBody}>
                Captions are written English or Hindi, often a second language. The avatar signs in the language many Deaf
                people grew up with.
              </p>
            </div>
          </div>
          <div className={`${s.card} ${s.paceCard} ${s.reveal} ${s.d2}`}>
            <h3 className={s.cardTitle}>Keeps up with the video</h3>
            <p className={s.gone}>
              <span>Caption gone</span>…so the cache sits right next to the core, and that&apos;s why…
            </p>
            <p className={s.cardBody}>Captions vanish as fast as people talk. Signing moves at the video&apos;s pace, and you can slow it down.</p>
          </div>
        </div>

        <div className={s.row}>
          <div className={`${s.card} ${s.reveal}`}>
            <p className={s.tone}>
              “I&apos;m <span className={s.tag}>really</span> sorry” and “I&apos;m sorry<span className={s.tag}>?</span>” look almost
              the same in captions.
            </p>
            <div>
              <h3 className={s.cardTitle}>Tone and feeling</h3>
              <p className={s.cardBody}>In sign language, face and hands carry emphasis, questions and emotion.</p>
            </div>
          </div>
          <div className={`${s.card} ${s.whyCard} ${s.reveal} ${s.d2}`}>
            <span className={`ss-wordmark ${s.whyMark}`}>
              sign<em>side</em>
            </span>
            <h2 id="why-title" className={s.whyTitle}>
              Why
              <br />
              signing?
            </h2>
          </div>
          <div className={`${s.card} ${s.reveal} ${s.d3}`}>
            <div className={s.beside} aria-hidden="true">
              <span />
            </div>
            <div>
              <h3 className={s.cardTitle}>Beside the video</h3>
              <p className={s.cardBody}>No more darting to a strip at the bottom. The signer sits next to the action.</p>
            </div>
          </div>
        </div>

        <div className={s.row}>
          <div className={`${s.card} ${s.short} ${s.reveal}`}>
            <h3 className={s.cardTitle}>Smarter than raw captions</h3>
            <p className={s.cardBody}>
              Works on videos with English captions, auto-captions included. Names and jargon are checked against the web with
              Exa, so a caption typo doesn&apos;t become a wrong sign.
            </p>
          </div>
          <div className={`${s.card} ${s.cardWide} ${s.besideCaptions} ${s.reveal} ${s.d2}`}>
            <p>
              Captions still matter: many deaf and hard-of-hearing people rely on them, and reading levels vary from person to
              person. signside sits <em>beside</em> captions, not instead of them.
            </p>
          </div>
        </div>
      </section>

      <section id="how" className={s.how} aria-labelledby="how-title">
        <div className={s.row}>
          <div className={`${s.howSteps} ${s.reveal}`}>
            <div className={s.howLabel}>
              How it works
              <span>
                <ArrowRight />
              </span>
            </div>
            <h2 id="how-title" className={s.h2Mid}>
              Open a video. <span className="accent">That&apos;s the setup.</span>
            </h2>
            <ol className={s.steps}>
              {steps.map((step, i) => (
                <li key={step.title}>
                  <span className={s.stepArt} style={{ background: step.art }} aria-hidden="true" />
                  <span className={s.stepText}>
                    <strong>
                      {step.title} <span>/ 0{i + 1}</span>
                    </strong>
                    {step.body}
                  </span>
                  <span className={s.dots} aria-hidden="true">
                    {"●".repeat(i + 1) + "○".repeat(2 - i)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className={`${s.howVisual} ${s.reveal} ${s.d2}`} aria-hidden="true">
            <div className={s.glassCard}>
              <div className={s.glassTop}>
                <span className={s.bigNum}>01</span>
                <span className={s.switch} />
              </div>
              <strong>Auto-connect is on</strong>
              <span>The YouTube video in your tab is picked up the moment it appears.</span>
            </div>
            <ul className={s.pills}>
              {["Video connected", "ASL selected", "Signing live"].map((p) => (
                <li key={p}>
                  {p}
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={s.whoSection} aria-labelledby="who-title">
        <div className={s.whoHead}>
          <span className="eyebrow">Who it&apos;s for</span>
          <h2 id="who-title" className={s.h2Mid}>
            Built for the <span className="accent">Deaf community</span> first.
          </h2>
        </div>
        <ul className={s.whoList}>
          {people.map((p, i) => (
            <li key={p.who} className={`${s.who} ${s.reveal}`}>
              <span className={s.whoDot} style={{ background: p.dot }} aria-hidden="true" />
              <strong>
                {p.who} <span>/ 0{i + 1}</span>
              </strong>
              <p>{p.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.join} aria-labelledby="join-title">
        <div className={s.joinStage}>
          <h2 id="join-title">
            Let every video speak <span className="serif">your</span> language
          </h2>
          <p>
            Paste a YouTube link to try it now, or browse the <Link href="/signs">signs the avatar knows</Link>. We&apos;re
            building this with Deaf users, not just for them.
          </p>
          <div className={s.joinForm}>
            <LinkForm id="link-bottom" />
          </div>
        </div>
      </section>

      <p className={s.sources}>
        Figures: World Federation of the Deaf (70M+ deaf people in signing communities); Census of India 2011 (about 50 lakh
        deaf people); press reports, 2020 (fewer than 300 certified ISL interpreters).
      </p>
    </main>
  );
}
