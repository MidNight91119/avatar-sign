import Link from "next/link";
import { LinkForm } from "../link-form";
import s from "./landing.module.css";

export function Join() {
  return (
    <section className={s.join} aria-labelledby="join-title">
      <div className={s.joinStage}>
        <h2 id="join-title">
          Let every video speak <span className="serif">your</span> language
        </h2>
        <p>
          Paste a YouTube link to try it now, or browse the <Link href="/signs">signs the avatar knows</Link>. We&apos;re building
          this with Deaf users, not just for them.
        </p>
        <div className={s.joinForm}>
          <LinkForm id="link-bottom" />
        </div>
      </div>
    </section>
  );
}
