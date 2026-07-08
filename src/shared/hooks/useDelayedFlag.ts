import { useEffect, useState } from "react";

/**
 * Returns `true` only after `active` has stayed `true` for at least `delayMs`.
 * Useful to avoid flashing a loader on fast operations: the flag stays `false`
 * for quick updates and turns `true` only when the work takes longer than the
 * threshold. Resets immediately when `active` becomes `false`.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [isElapsed, setIsElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setIsElapsed(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsElapsed(true);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [active, delayMs]);

  return active && isElapsed;
}
