"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import styles from "./AdminSectionTransition.module.scss";
import {
  clipOverlayBoxToViewport,
  shouldUseScopedOverlayTarget,
} from "@/features/admin/utils/overlay-box";
import { isAdminEntryPath } from "@/server/auth/config";

const FADE_OUT_MS = 380;
const MIN_VISIBLE_MS = 320;
const SAFETY_TIMEOUT_MS = 12_000;
const LOGO_SRC = "/logos/logo-blue.svg";
const ADMIN_CONTENT_SELECTOR = "[data-admin-content]";
const ADMIN_OVERLAY_TARGET_SELECTOR = "[data-admin-overlay-target]";
const ADMIN_MOBILE_DOCK_SELECTOR = "[data-admin-mobile-dock]";

type TransitionPhase = "idle" | "visible" | "exiting";

type ContentBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type BeginNavigationOptions = {
  exact?: boolean;
};

type AdminSectionTransitionContextValue = {
  beginNavigation: (href: string, options?: BeginNavigationOptions) => void;
  reportSectionReady: () => void;
  phase: TransitionPhase;
  pendingHref: string | null;
  /** True while the brand overlay is covering content (before fade-out). */
  isCoveringContent: boolean;
};

const AdminSectionTransitionContext =
  createContext<AdminSectionTransitionContextValue | null>(null);

export function useAdminSectionTransition(): AdminSectionTransitionContextValue | null {
  return useContext(AdminSectionTransitionContext);
}

export function useBeginAdminSectionNavigation() {
  const transition = useAdminSectionTransition();

  return useCallback(
    (href: string, options?: BeginNavigationOptions) => {
      transition?.beginNavigation(href, options);
    },
    [transition],
  );
}

/** Call from section pages when primary content can be shown without internal loaders. */
export function useReportAdminSectionReady(isReady: boolean): void {
  const transition = useAdminSectionTransition();
  const reportSectionReady = transition?.reportSectionReady;

  useEffect(() => {
    if (isReady) {
      reportSectionReady?.();
    }
  }, [isReady, reportSectionReady]);
}

function normalizeAdminPath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? path;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function isSameAdminSection(pathname: string, href: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  return current === target || current.startsWith(`${target}/`);
}

function readViewportClipBottom(): number {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const dock = document.querySelector(ADMIN_MOBILE_DOCK_SELECTOR);

  if (!(dock instanceof HTMLElement)) {
    return viewportHeight;
  }

  const dockRect = dock.getBoundingClientRect();
  if (dockRect.height <= 0) {
    return viewportHeight;
  }

  return Math.min(viewportHeight, dockRect.top);
}

function readAdminContentBox(pendingHref: string | null): ContentBox | null {
  const overlayTarget = document.querySelector(ADMIN_OVERLAY_TARGET_SELECTOR);
  const adminContent = document.querySelector(ADMIN_CONTENT_SELECTOR);
  const overlayScope =
    overlayTarget instanceof HTMLElement
      ? overlayTarget.getAttribute("data-admin-overlay-scope")
      : null;
  const useInnerTarget =
    overlayTarget instanceof HTMLElement &&
    shouldUseScopedOverlayTarget(pendingHref, overlayScope);
  const element = useInnerTarget
    ? overlayTarget
    : adminContent instanceof HTMLElement
      ? adminContent
      : overlayTarget instanceof HTMLElement
        ? overlayTarget
        : null;

  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;

  return clipOverlayBoxToViewport(rect, {
    top: 0,
    left: 0,
    right: viewportWidth,
    bottom: readViewportClipBottom(),
  });
}

function useAdminContentBox(
  active: boolean,
  pendingHref: string | null,
): ContentBox | null {
  const [box, setBox] = useState<ContentBox | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setBox(readAdminContentBox(pendingHref));
    });

    const observeTargets = () => {
      resizeObserver.disconnect();
      const overlayTarget = document.querySelector(ADMIN_OVERLAY_TARGET_SELECTOR);
      const adminContent = document.querySelector(ADMIN_CONTENT_SELECTOR);

      if (overlayTarget instanceof HTMLElement) {
        resizeObserver.observe(overlayTarget);
      }

      if (adminContent instanceof HTMLElement) {
        resizeObserver.observe(adminContent);
      }

      const mobileDock = document.querySelector(ADMIN_MOBILE_DOCK_SELECTOR);
      if (mobileDock instanceof HTMLElement) {
        resizeObserver.observe(mobileDock);
      }

      setBox(readAdminContentBox(pendingHref));
    };

    observeTargets();

    const mutationObserver = new MutationObserver((mutations) => {
      const shouldRetarget = mutations.some((mutation) => {
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
        return nodes.some((node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          return (
            node.hasAttribute("data-admin-overlay-target") ||
            Boolean(node.querySelector(ADMIN_OVERLAY_TARGET_SELECTOR))
          );
        });
      });

      if (shouldRetarget) {
        observeTargets();
      }
    });
    const adminContent = document.querySelector(ADMIN_CONTENT_SELECTOR);

    if (adminContent instanceof HTMLElement) {
      mutationObserver.observe(adminContent, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener("resize", observeTargets);
    window.addEventListener("scroll", observeTargets, true);
    window.visualViewport?.addEventListener("resize", observeTargets);
    window.visualViewport?.addEventListener("scroll", observeTargets);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", observeTargets);
      window.removeEventListener("scroll", observeTargets, true);
      window.visualViewport?.removeEventListener("resize", observeTargets);
      window.visualViewport?.removeEventListener("scroll", observeTargets);
    };
  }, [active, pendingHref]);

  return box;
}

type AdminSectionTransitionProviderProps = {
  children: ReactNode;
  entryHomeHref?: string;
};

export function AdminSectionTransitionProvider({
  children,
  entryHomeHref,
}: AdminSectionTransitionProviderProps) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [contentReady, setContentReady] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const targetHrefRef = useRef<string | null>(null);
  const shownAtRef = useRef(0);
  const safetyTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<TransitionPhase>("idle");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const beginNavigation = useCallback(
    (href: string, options?: BeginNavigationOptions) => {
      const alreadyThere = options?.exact
        ? normalizeAdminPath(pathname) === normalizeAdminPath(href)
        : isSameAdminSection(pathname, href);

      if (alreadyThere) {
        return;
      }

      clearSafetyTimer();
      const nextHref = normalizeAdminPath(href);
      targetHrefRef.current = nextHref;
      setPendingHref(nextHref);
      shownAtRef.current = Date.now();
      setContentReady(false);
      setPhase("visible");

      safetyTimerRef.current = window.setTimeout(() => {
        setPhase("exiting");
      }, SAFETY_TIMEOUT_MS);
    },
    [clearSafetyTimer, pathname],
  );

  useLayoutEffect(() => {
    if (!entryHomeHref) {
      return;
    }

    if (!isAdminEntryPath(normalizeAdminPath(pathname))) {
      return;
    }

    beginNavigation(entryHomeHref);
  }, [beginNavigation, entryHomeHref, pathname]);

  const reportSectionReady = useCallback(() => {
    if (phaseRef.current !== "visible" || !targetHrefRef.current) {
      return;
    }

    if (!isSameAdminSection(pathname, targetHrefRef.current)) {
      return;
    }

    setContentReady(true);
  }, [pathname]);

  useEffect(() => {
    if (phase !== "visible" || !targetHrefRef.current || !contentReady) {
      return;
    }

    if (!isSameAdminSection(pathname, targetHrefRef.current)) {
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const timer = window.setTimeout(() => {
      setPhase("exiting");
    }, wait);

    return () => {
      window.clearTimeout(timer);
    };
  }, [contentReady, pathname, phase]);

  useEffect(() => {
    if (phase !== "exiting") {
      return;
    }

    clearSafetyTimer();

    const timer = window.setTimeout(() => {
      setPhase("idle");
      setContentReady(false);
      setPendingHref(null);
      targetHrefRef.current = null;
    }, FADE_OUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearSafetyTimer, phase]);

  useEffect(() => {
    return () => {
      clearSafetyTimer();
    };
  }, [clearSafetyTimer]);

  const contextValue = useMemo(
    () => ({
      beginNavigation,
      reportSectionReady,
      phase,
      pendingHref,
      isCoveringContent: phase === "visible",
    }),
    [beginNavigation, pendingHref, phase, reportSectionReady],
  );

  return (
    <AdminSectionTransitionContext.Provider value={contextValue}>
      {children}
    </AdminSectionTransitionContext.Provider>
  );
}

export function AdminSectionLoadingOverlay() {
  const transition = useAdminSectionTransition();
  const phase = transition?.phase ?? "idle";
  const isActive = phase !== "idle";
  const [mounted, setMounted] = useState(false);
  const contentBox = useAdminContentBox(
    isActive,
    transition?.pendingHref ?? null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isActive || !contentBox) {
    return null;
  }

  const overlayStyle: CSSProperties = {
    position: "fixed",
    top: contentBox.top,
    left: contentBox.left,
    width: contentBox.width,
    height: contentBox.height,
  };

  return createPortal(
    <div
      className={`${styles.overlay} ${phase === "exiting" ? styles.overlayExiting : ""}`}
      style={overlayStyle}
      role="status"
      aria-live="polite"
      aria-busy={phase === "visible"}
      aria-label="Cargando sección"
    >
      <img
        className={styles.logo}
        src={LOGO_SRC}
        alt=""
        width={220}
        height={80}
        decoding="async"
      />
    </div>,
    document.body,
  );
}
