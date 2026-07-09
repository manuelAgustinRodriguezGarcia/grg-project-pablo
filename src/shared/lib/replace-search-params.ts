/**
 * Updates the current URL query string via history.replaceState.
 * Avoids Next.js router navigation (no RSC refetch / scroll jump).
 * Pass `null` or `""` to delete a key. Other params are left intact.
 */
export function replaceSearchParams(
  updates: Record<string, string | null | undefined>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
}
