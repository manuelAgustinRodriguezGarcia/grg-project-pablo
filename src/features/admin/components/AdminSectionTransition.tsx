"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import styles from "./AdminSectionTransition.module.scss";

const FADE_OUT_MS = 380;
const MIN_VISIBLE_MS = 320;
const SAFETY_TIMEOUT_MS = 12_000;
const LOGO_SRC = "/logos/logo-blue.svg";
const ADMIN_CONTENT_SELECTOR = "[data-admin-content]";

type TransitionPhase = "idle" | "visible" | "exiting";

type ContentBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type AdminSectionTransitionContextValue = {
  beginNavigation: (href: string) => void;
  reportSectionReady: () => void;
  phase: TransitionPhase;
  /** True while the brand overlay is covering content (before fade-out). */
  isCoveringContent: boolean;
};

const AdminSectionTransitionContext =
  createContext<AdminSectionTransitionContextValue | null>(null);

export function useAdminSectionTransition(): AdminSectionTransitionContextValue | null {
  return useContext(AdminSectionTransitionContext);
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
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

function isSameAdminSection(pathname: string, href: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  return current === target || current.startsWith(`${target}/`);
}

function readAdminContentBox(): ContentBox | null {
  const element = document.querySelector(ADMIN_CONTENT_SELECTOR);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function useAdminContentBox(active: boolean): ContentBox | null {
  const [box, setBox] = useState<ContentBox | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const update = () => {
      setBox(readAdminContentBox());
    };

    update();

    const element = document.querySelector(ADMIN_CONTENT_SELECTOR);
    const observer =
      element instanceof HTMLElement ? new ResizeObserver(update) : null;
    if (element instanceof HTMLElement && observer) {
      observer.observe(element);
    }

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active]);

  return box;
}

type AdminSectionTransitionProviderProps = {
  children: ReactNode;
};

export function AdminSectionTransitionProvider({
  children,
}: AdminSectionTransitionProviderProps) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [contentReady, setContentReady] = useState(false);
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
    (href: string) => {
      if (isSameAdminSection(pathname, href)) {
        return;
      }

      clearSafetyTimer();
      targetHrefRef.current = normalizeAdminPath(href);
      shownAtRef.current = Date.now();
      setContentReady(false);
      setPhase("visible");

      safetyTimerRef.current = window.setTimeout(() => {
        setPhase("exiting");
      }, SAFETY_TIMEOUT_MS);
    },
    [clearSafetyTimer, pathname],
  );

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
      isCoveringContent: phase === "visible",
    }),
    [beginNavigation, phase, reportSectionReady],
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
  const contentBox = useAdminContentBox(isActive);

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
