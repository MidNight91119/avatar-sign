"use client";

import { useCallback, useEffect, useState } from "react";
import { AvatarCanvas } from "@repo/ui/avatar-canvas";
import { captionAt } from "@repo/ui/caption";
import { SignPanel } from "@repo/ui/sign-panel";
import { useSignTrack } from "@repo/ui/use-sign-track";
import { usePolledTime } from "../../hooks/use-polled-time";
import { demoApi } from "../../lib/api";
import { Play } from "./icons";
import s from "./landing.module.css";

/** Seconds into the sample track where the reduced-motion still sits (a friendly HELLO). */
const STILL_AT = 0.4;

/** Live hero: a mock video whose subtitle and the signing panel both follow the sample track on a loop. */
export function HeroDemo() {
  const { track } = useSignTrack(demoApi, "sample-volcanoes", "ASL");
  const loop = (track?.segments.at(-1)?.end ?? 60) + 1.5;
  const [start] = useState(() => performance.now());
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const getTime = useCallback(() => (still ? STILL_AT : ((performance.now() - start) / 1000) % loop), [still, start, loop]);
  const time = usePolledTime(getTime, 250);
  const caption = captionAt(track, time);

  return (
    <div className={s.heroStage}>
      <div className={s.heroVideo} aria-hidden="true">
        <span className={s.badge}>
          <span className={s.greenDot} />
          Connected automatically
        </span>
        <span className={s.play}>
          <Play />
        </span>
        {caption.text ? <span className={s.subtitle}>{caption.text}</span> : null}
      </div>
      {/* A live demo for show: not interactive, hidden from assistive tech (the page text says the same). */}
      <div className={s.heroPanel} aria-hidden="true" inert>
        <div>
          <SignPanel
            mode="signing"
            avatar={<AvatarCanvas track={track} getTime={getTime} paused={still} />}
            langs={["ASL", "ISL"]}
            lang="ASL"
            head=""
            sub=""
            sourceLabel="Signing in ASL"
            sourceDetail="youtube.com/watch?v=sample-volcanoes"
            caption={caption}
            time={time}
            logoSrc="/brand/hand.png"
          />
        </div>
      </div>
    </div>
  );
}
