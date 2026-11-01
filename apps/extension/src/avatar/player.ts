import * as playerPackage from "@signstream/player";
import type { AvatarPlayer, AvatarPlayerOptions, CreateAvatarPlayer } from "../contracts";
import { createPlaceholderPlayer } from "./placeholder-player";

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
