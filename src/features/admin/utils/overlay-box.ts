export type OverlayBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function normalizeAdminPath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? path;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

/**
 * Inner overlay targets (e.g. Facturación content below the pill nav) apply
 * only while navigating inside that section. Leaving it covers the full main pane.
 */
export function shouldUseScopedOverlayTarget(
  pendingHref: string | null,
  overlayScope: string | null,
): boolean {
  if (!pendingHref || !overlayScope) {
    return false;
  }

  const href = normalizeAdminPath(pendingHref);
  const scope = normalizeAdminPath(overlayScope);
  return href === scope || href.startsWith(`${scope}/`);
}

/** Intersects a target rect with the visible viewport clip. */
export function clipOverlayBoxToViewport(
  target: Pick<DOMRect, "top" | "left" | "right" | "bottom">,
  viewport: Pick<DOMRect, "top" | "left" | "right" | "bottom">,
): OverlayBox {
  const top = Math.max(target.top, viewport.top);
  const left = Math.max(target.left, viewport.left);
  const right = Math.min(target.right, viewport.right);
  const bottom = Math.min(target.bottom, viewport.bottom);

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}
