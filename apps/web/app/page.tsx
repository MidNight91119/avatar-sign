import { Aim } from "../components/landing/aim";
import { sources } from "../components/landing/content";
import { Hero } from "../components/landing/hero";
import { How } from "../components/landing/how";
import s from "../components/landing/landing.module.css";
import { Join } from "../components/landing/join";
import { Who } from "../components/landing/who";
import { Why } from "../components/landing/why";

/** Landing page (/). Each section lives in components/landing/; copy is in components/landing/content.ts. */
export default function Home() {
  return (
    <main>
      <Hero />
      <div className={s.haze} aria-hidden="true" />
      <Aim />
      <Why />
      <How />
      <Who />
      <Join />
      <p className={s.sources}>{sources}</p>
    </main>
  );
}
