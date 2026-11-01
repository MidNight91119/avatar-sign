import { stats } from "./content";
import { ArrowUpRight } from "./icons";
import s from "./landing.module.css";

const delay = ["", s.d2, s.d3];

export function Aim() {
  return (
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
          <ArrowUpRight />
        </a>
      </div>
      <dl className={s.stats}>
        {stats.map((st, i) => (
          <div key={st.label} className={`${s.stat} ${s.reveal} ${delay[i] ?? ""}`}>
            <dt>{st.label}</dt>
            <dd>{st.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
