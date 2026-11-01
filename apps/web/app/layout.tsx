import type { Metadata } from "next";
import { Inter, Inter_Tight, Instrument_Serif } from "next/font/google";
import { SiteFooter } from "../components/site/site-footer";
import { SiteNav } from "../components/site/site-nav";
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
          <SiteNav />
          <div id="main">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
