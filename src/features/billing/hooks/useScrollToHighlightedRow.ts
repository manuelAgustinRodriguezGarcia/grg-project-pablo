"use client";

import { useEffect } from "react";

export function useScrollToHighlightedRow(
  highlightId: string | undefined,
  ready: boolean,
): void {
  useEffect(() => {
    if (!highlightId || !ready) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>(
        `[data-list-highlight="${CSS.escape(highlightId)}"]`,
      );
      const target = [...nodes].find((node) => node.getClientRects().length > 0);
      if (!target) {
        return;
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [highlightId, ready]);
}
