"use client";

import { useState } from "react";
import { SIGN_LANGS, type SignLang } from "@signstream/shared";
import { AvatarCanvas } from "@repo/ui/avatar-canvas";
import { captionAt, nextSpeed, trackErrorMessage } from "@repo/ui/caption";
import { SignPanel } from "@repo/ui/sign-panel";
import { useSignTrack } from "@repo/ui/use-sign-track";
import { usePolledTime } from "../../hooks/use-polled-time";
import { useYouTubePlayer } from "../../hooks/use-youtube-player";
import { api, apiUrl } from "../../lib/api";

/** /watch: the YouTube player on the left, the signing panel on the right, both on the video's clock. */
export function WatchView({ videoId }: { videoId: string }) {
  const yt = useYouTubePlayer(videoId);
  const time = usePolledTime(yt.getTime);
  const [lang, setLang] = useState<SignLang>("ASL");
  const [signing, setSigning] = useState(true);
  const { track, progress, error } = useSignTrack(api, videoId, lang);

  const pct = Math.round((progress ?? 0) * 100);
  const mode = signing && track ? "signing" : "idle";

  return (
    <div className="watch">
      <div className="watch-video">
        <div ref={yt.frame} className="watch-frame" />
        {apiUrl ? null : (
          <p className="watch-note">
            Demo mode: the API isn&apos;t connected, so the avatar follows the sample volcano track instead of this video&apos;s
            captions.
          </p>
        )}
      </div>
      <div className="watch-panel">
        <SignPanel
          mode={mode}
          avatar={<AvatarCanvas track={mode === "signing" ? track : undefined} getTime={yt.getTime} paused={yt.paused} />}
          logoSrc="/brand/hand.png"
          langs={SIGN_LANGS}
          lang={lang}
          onLang={(l) => setLang(l as SignLang)}
          speed={yt.rate}
          onSpeed={() => yt.setRate(nextSpeed(yt.rate))}
          head={error ? "Can't sign this video." : track ? "Ready to sign." : `Preparing signs… ${pct}%`}
          sub={
            error
              ? trackErrorMessage(error)
              : track
                ? "Press start. Every sentence gets signed beside the video."
                : "Turning the captions into sign language."
          }
          sourceLabel={error ? "Couldn't prepare signs" : track ? `Signing in ${lang}` : `Preparing… ${pct}%`}
          sourceDetail={`youtube.com/watch?v=${videoId}`}
          caption={captionAt(track, time)}
          time={time}
          onToggle={track ? () => setSigning(!signing) : undefined}
        />
      </div>
    </div>
  );
}
