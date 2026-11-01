import type { Metadata } from "next";
import { parseVideoId } from "@repo/ui/youtube";
import { LinkForm } from "../../components/link-form";
import { WatchView } from "../../components/watch/watch-view";

export const metadata: Metadata = { title: "Watch with signing" };

export default async function WatchPage({ searchParams }: { searchParams: Promise<{ v?: string | string[] }> }) {
  const { v } = await searchParams;
  const raw = Array.isArray(v) ? v[0] : v;
  const videoId = raw ? parseVideoId(raw) : null;

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">
          Watch with <span className="serif">signing</span>
        </h1>
        <div className="page-form">
          <LinkForm id="watch-link" label={videoId ? "Change video" : "Watch with signing"} defaultValue={raw} />
          {raw && !videoId ? (
            <p className="form-error" role="alert">
              That doesn&apos;t look like a YouTube video link. Try one like youtube.com/watch?v=…
            </p>
          ) : null}
        </div>
      </div>
      {videoId ? (
        <WatchView key={videoId} videoId={videoId} />
      ) : (
        <p className="page-empty">Paste a YouTube link above. The video plays on the left and the avatar signs it on the right.</p>
      )}
    </main>
  );
}
