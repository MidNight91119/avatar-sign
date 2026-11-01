import s from "./landing.module.css";

export function Why() {
  return (
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
              Captions are written English or Hindi, often a second language. The avatar signs in the language many Deaf people
              grew up with.
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
            “I&apos;m <span className={s.tag}>really</span> sorry” and “I&apos;m sorry<span className={s.tag}>?</span>” look almost the
            same in captions.
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
            Works on videos with English captions, auto-captions included. Names and jargon are checked against the web with Exa,
            so a caption typo doesn&apos;t become a wrong sign.
          </p>
        </div>
        <div className={`${s.card} ${s.cardWide} ${s.besideCaptions} ${s.reveal} ${s.d2}`}>
          <p>
            Captions still matter: many deaf and hard-of-hearing people rely on them, and reading levels vary from person to person.
            signside sits <em>beside</em> captions, not instead of them.
          </p>
        </div>
      </div>
    </section>
  );
}
