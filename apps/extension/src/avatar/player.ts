import * as playerPackage from "@signstream/player";
import type { SignLang, SignTrack } from "@signstream/shared";
import { createPlaceholderPlayer } from "./placeholder-player";

// PLAN §4.4. @signstream/player doesn't export these yet; import them from there once it does.
export interface AvatarPlayer {
  load(track: SignTrack): void;
  tick(currentTimeSec: number): void;
  setSpeed(rate: number): void;
  play(): void;
  pause(): void;
  playSign(gloss: string): void;
  destroy(): void;
}

export interface AvatarPlayerOptions {
  lang?: SignLang;
  assetsBaseUrl?: string;
  showGloss?: boolean;
}

export type CreateAvatarPlayer = (container: HTMLElement, opts?: AvatarPlayerOptions) => AvatarPlayer;

export type PlayerKind = "avatar" | "placeholder";
export type CreatePlayer = typeof createPlayer;

/**
 * Hasan's avatar once @signstream/player exports `createAvatarPlayer` (PLAN §4.4), with no change needed here;
 * the gloss-text placeholder until then, or if the avatar fails to start.
 */
export function createPlayer(
  container: HTMLElement,
  opts: AvatarPlayerOptions,
  pkg: Record<string, unknown> = playerPackage,
): { player: AvatarPlayer; kind: PlayerKind } {
  const createAvatarPlayer = pkg.createAvatarPlayer as CreateAvatarPlayer | undefined;
  if (typeof createAvatarPlayer === "function") {
    try {
      return { player: createAvatarPlayer(container, opts), kind: "avatar" };
    } catch (err) {
      console.warn("[SignStream] avatar player failed to start; showing glosses instead", err);
    }
  }
  return { player: createPlaceholderPlayer(container), kind: "placeholder" };
}
