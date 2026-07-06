import { useEffect, type RefObject } from "react";

const HEADER_SOLID_SCROLL_DISTANCE = 56;

export function useTableHeaderScrollProgress(
  tableWrapRef: RefObject<HTMLDivElement | null>,
  resetKey?: unknown,
) {
  useEffect(() => {
    const tableWrap = tableWrapRef.current;
    if (!tableWrap) {
      return;
    }

    const syncHeaderSolidState = () => {
      const progress = Math.min(1, tableWrap.scrollTop / HEADER_SOLID_SCROLL_DISTANCE);
      tableWrap.style.setProperty("--header-scroll-progress", progress.toFixed(3));
    };

    syncHeaderSolidState();
    tableWrap.addEventListener("scroll", syncHeaderSolidState, { passive: true });

    return () => {
      tableWrap.removeEventListener("scroll", syncHeaderSolidState);
      tableWrap.style.removeProperty("--header-scroll-progress");
    };
  }, [tableWrapRef, resetKey]);
}
