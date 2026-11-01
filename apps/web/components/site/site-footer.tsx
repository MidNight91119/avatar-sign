import { Wordmark } from "@repo/ui/sign-panel";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Wordmark className="site-footer-mark" />
      <span>Sign language beside every video. Glossing by Cerebras, video context and sign references by Exa.</span>
    </footer>
  );
}
