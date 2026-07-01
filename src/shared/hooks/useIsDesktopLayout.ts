"use client";

import { useSyncExternalStore } from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

function subscribeToDesktopLayout(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopLayoutSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getDesktopLayoutServerSnapshot() {
  return true;
}

export function useIsDesktopLayout(): boolean {
  return useSyncExternalStore(
    subscribeToDesktopLayout,
    getDesktopLayoutSnapshot,
    getDesktopLayoutServerSnapshot,
  );
}
