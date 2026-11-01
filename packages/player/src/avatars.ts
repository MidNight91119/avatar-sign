/** The painted avatars in the shader, by index: 0 Suki (deco portrait), 1 Sara (hanfu, light backdrop), 2 Sasha (crimson hijab). */
export const AVATARS = ["Suki", "Sara", "Sasha"] as const;

/** Sara: the avatar every host showed before the choice existed. */
export const DEFAULT_AVATAR = 1;

/** A valid avatar index, or the default for anything else (unset, out of range, a stale stored value). */
export function avatarIndex(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < AVATARS.length ? (value as number) : DEFAULT_AVATAR;
}
