import type { Metadata } from "next";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/inter-tight/index.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import { SiteFooter } from "../components/site/site-footer";
import { SiteNav } from "../components/site/site-nav";
import "@repo/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "signside: every video, in sign language", template: "%s · signside" },
  description: "An avatar that signs YouTube videos as they play, beside the video and beside the captions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
