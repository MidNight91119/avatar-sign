import Link from "next/link";
import { Wordmark } from "@repo/ui/sign-panel";

/** Sticky dark pill: logo + wordmark, section links, "Try it". */
export function SiteNav() {
  return (
    <nav aria-label="Main" className="site-nav">
      <div className="site-nav-pill">
        <Link href="/" className="site-nav-brand" aria-label="signside home">
          <span className="site-nav-mark">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo */}
            <img src="/brand/hand.png" alt="" width={24} height={24} />
          </span>
          <Wordmark />
        </Link>
        <Link href="/#why">Why signing</Link>
        <Link href="/signs">Signs</Link>
        <Link href="/watch" className="site-nav-cta">
          Try it
        </Link>
      </div>
    </nav>
  );
}
