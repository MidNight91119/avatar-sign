import { people } from "./content";
import s from "./landing.module.css";

export function Who() {
  return (
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
  );
}
