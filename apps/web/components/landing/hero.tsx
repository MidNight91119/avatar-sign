import { LinkForm } from "../link-form";
import { chips } from "./content";
import { HeroDemo } from "./hero-demo";
import s from "./landing.module.css";

export function Hero() {
  return (
    <header className={s.hero}>
      <HeroDemo />
      <div className={s.intro}>
        <div className={s.introMain}>
          <h1 className={s.h1}>
            Every video online, now in <span className="serif">sign language</span>
          </h1>
          <p className={s.chips}>
            <span className={s.chipsLabel}>Signs along with</span>
            {chips.map((c) => (
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
  );
}
