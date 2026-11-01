import type { Metadata } from "next";
import { SignsView } from "../../components/signs/signs-view";

export const metadata: Metadata = { title: "Signs" };

export default function SignsPage() {
  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">
          Every sign the avatar <span className="serif">knows</span>
        </h1>
        <p className="page-lede">
          Click a sign to watch the avatar sign it. Type a word we don&apos;t have yet and it fingerspells it, with links to
          learn the real sign.
        </p>
      </div>
      <SignsView />
    </main>
  );
}
