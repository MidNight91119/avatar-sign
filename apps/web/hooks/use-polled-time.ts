import { useEffect, useState } from "react";

/**
 * Media time as React state, sampled `ms` apart: enough for captions and the live clock. The avatar reads the
 * clock itself every frame, so React never re-renders per frame (H-I8).
 */
export function usePolledTime(getTime: () => number | undefined, ms = 200): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const t = getTime();
      if (t !== undefined) setTime(t);
    }, ms);
    return () => clearInterval(id);
  }, [getTime, ms]);
  return time;
}
