"use client";

import { useCallback } from "react";
import { replaceSearchParams } from "@/shared/lib/replace-search-params";

/**
 * Returns a stable callback that mirrors selection state into the URL
 * without triggering Next.js soft navigation.
 */
export function useReplaceSearchParams() {
  return useCallback((updates: Record<string, string | null | undefined>) => {
    replaceSearchParams(updates);
  }, []);
}
