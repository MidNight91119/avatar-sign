import type { Metadata } from "next";
import { Inter, Inter_Tight, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { Wordmark } from "@repo/ui/sign-panel";
import "@repo/ui/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-inter-tight" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: { default: "signside: every video, in sign language", template: "%s · signside" },
  description: "An avatar that signs YouTube videos as they play, beside the video and beside the captions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="frame">
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
          <div id="main">{children}</div>
          <footer className="site-footer">
            <Wordmark className="site-footer-mark" />
            <span>
              Sign language beside every video. Glossing by Cerebras, video context and sign references by Exa.
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
