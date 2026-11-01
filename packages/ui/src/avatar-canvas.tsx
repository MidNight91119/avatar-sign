"use client";

import { useEffect, useRef } from "react";
import type { SignTrack } from "@signstream/shared";
import { createAvatarPlayer, type AvatarPlayer } from "@signstream/player";

const EMPTY: SignTrack = { videoId: "", lang: "ASL", source: "manual", status: "ready", segments: [] };

export interface AvatarCanvasProps {
  /** Track to sign. Pass each partial snapshot as it arrives; the media clock is kept. Leave out to rest. */
  track?: SignTrack;
  /** Read every animation frame: the video's current time in seconds. Leave out for preview-only use. */
  getTime?: () => number | undefined;
  /** Paused video → the hands hold still. */
  paused?: boolean;
  /** Preview one sign (the /signs page). A new `key` replays it. */
  sign?: { gloss: string; key: number };
  /** Preview speed. Track signing follows `getTime` and is never rescaled. */
  rate?: number;
  showGloss?: boolean;
  /** Which painted avatar (index into `AVATARS` from `@signstream/player`); defaults to Sara. */
  avatar?: number;
  className?: string;
}

/**
 * The signing avatar as a React component: mounts `createAvatarPlayer` (PLAN §4.4), ticks it with
 * `getTime()` every frame without React state, and destroys it on unmount. Put it in `SignPanel`'s `avatar`.
 */
export function AvatarCanvas({ track, getTime, paused = false, sign, rate = 1, showGloss, avatar, className = "" }: AvatarCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AvatarPlayer | null>(null);
  const clock = useRef(getTime);
  useEffect(() => {
    clock.current = getTime;
  });

  useEffect(() => {
    const p = createAvatarPlayer(host.current!, { showGloss, avatar });
    player.current = p;
    let raf = 0;
    const loop = () => {
      const t = clock.current?.();
      if (t !== undefined) p.tick(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      p.destroy();
      player.current = null;
    };
  }, [showGloss, avatar]);

  useEffect(() => player.current?.load(track ?? EMPTY), [track, showGloss, avatar]);
  useEffect(() => (paused ? player.current?.pause() : player.current?.play()), [paused, showGloss, avatar]);
  useEffect(() => player.current?.setSpeed(rate), [rate, showGloss, avatar]);
  useEffect(() => {
    if (sign) player.current?.playSign(sign.gloss);
  }, [sign, showGloss, avatar]);

  return <div ref={host} className={`ss-avatar-canvas ${className}`} aria-hidden="true" />;
}
