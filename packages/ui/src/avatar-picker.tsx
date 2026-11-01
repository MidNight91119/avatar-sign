"use client";

import { useEffect, useState } from "react";
import { AVATARS, DEFAULT_AVATAR, avatarIndex } from "@signstream/player";

const KEY = "signside:avatar";

/** The chosen avatar, remembered in this browser (each host page has its own storage). */
export function useAvatar(): [number, (avatar: number) => void] {
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) setAvatar(avatarIndex(Number(stored)));
    } catch {
      // storage blocked: keep the default
    }
  }, []);
  const choose = (next: number) => {
    setAvatar(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      // storage blocked: the choice lasts until the page closes
    }
  };
  return [avatar, choose];
}

/** Avatar choice for `SignPanel`'s `headerAction`. */
export function AvatarPicker({ value, onChange }: { value: number; onChange: (avatar: number) => void }) {
  return (
    <div role="group" aria-label="Avatar" className="ss-segmented ss-avatars">
      {AVATARS.map((name, i) => (
        <button key={name} type="button" aria-pressed={i === value} onClick={() => onChange(i)}>
          {name}
        </button>
      ))}
    </div>
  );
}
