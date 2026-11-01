import { howPills, steps } from "./content";
import { ArrowRight, Check } from "./icons";
import s from "./landing.module.css";

export function How() {
  return (
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
                  {"●".repeat(i + 1) + "○".repeat(steps.length - 1 - i)}
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
            {howPills.map((p) => (
              <li key={p}>
                {p}
                <span>
                  <Check />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
