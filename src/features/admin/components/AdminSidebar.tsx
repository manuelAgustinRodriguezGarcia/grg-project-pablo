"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AdminSignOutButton } from "@/features/auth/components/AdminSignOutButton";
import {
  ADMIN_MOBILE_DOCK_HREFS,
  ADMIN_NAV_ITEMS,
} from "@/features/admin/data/adminNav";
import { USER_ROLE_LABELS } from "@/features/users/types/user.types";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ShieldUser,
  UserRound,
  X,
  ICON_STROKE,
} from "@/shared/icons";
import type { UserRole } from "@/generated/prisma/client";
import { AdminLogo } from "./AdminLogo";
import { AdminNavItem } from "./AdminNavItem";
import styles from "./AdminSidebar.module.scss";

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";
const DOCK_HREF_SET = new Set<string>(ADMIN_MOBILE_DOCK_HREFS);

type AdminSidebarProps = {
  userEmail: string;
  userRole: UserRole;
};

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function measureNavIndicator(
  list: HTMLUListElement,
  href: string,
): { top: number; height: number } | null {
  const links = list.querySelectorAll<HTMLElement>("[data-nav-href]");
  let link: HTMLElement | null = null;
  for (const candidate of links) {
    if (candidate.getAttribute("data-nav-href") === href) {
      link = candidate;
      break;
    }
  }
  if (!link) {
    return null;
  }

  const listRect = list.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  return {
    top: linkRect.top - listRect.top,
    height: linkRect.height,
  };
}

function readCollapsedPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

const sidebarCollapseListeners = new Set<() => void>();

function subscribeSidebarCollapse(onStoreChange: () => void): () => void {
  sidebarCollapseListeners.add(onStoreChange);
  return () => {
    sidebarCollapseListeners.delete(onStoreChange);
  };
}

function emitSidebarCollapseChange(): void {
  for (const listener of sidebarCollapseListeners) {
    listener();
  }
}

function getSidebarCollapseSnapshot(): boolean {
  return readCollapsedPreference();
}

function getSidebarCollapseServerSnapshot(): boolean {
  return false;
}

export function AdminSidebar({ userEmail, userRole }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";
  const navItems = ADMIN_NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin,
  );
  const dockItems = navItems.filter((item) => DOCK_HREF_SET.has(item.href));
  const isOverflowRouteActive = navItems.some(
    (item) =>
      !DOCK_HREF_SET.has(item.href) && isNavItemActive(pathname, item.href),
  );
  const RoleIcon = isAdmin ? ShieldUser : UserRound;
  const roleLabel = USER_ROLE_LABELS[userRole];
  const isCollapsed = useSyncExternalStore(
    subscribeSidebarCollapse,
    getSidebarCollapseSnapshot,
    getSidebarCollapseServerSnapshot,
  );

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isMoreMounted, setIsMoreMounted] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreSheetId = useId();
  const moreCloseTimerRef = useRef<number | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const [navIndicator, setNavIndicator] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const [navIndicatorReady, setNavIndicatorReady] = useState(false);

  const activeNavHref =
    navItems.find((item) => isNavItemActive(pathname, item.href))?.href ?? null;
  const navIndicatorHref = pendingHref ?? activeNavHref;

  const updateNavIndicator = useCallback(() => {
    const list = navListRef.current;
    if (!list || !navIndicatorHref) {
      setNavIndicator(null);
      return;
    }

    setNavIndicator(measureNavIndicator(list, navIndicatorHref));
  }, [navIndicatorHref]);

  const clearMoreCloseTimer = useCallback(() => {
    if (moreCloseTimerRef.current !== null) {
      window.clearTimeout(moreCloseTimerRef.current);
      moreCloseTimerRef.current = null;
    }
  }, []);

  const openMore = useCallback(() => {
    clearMoreCloseTimer();
    setIsMoreMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsMoreOpen(true);
      });
    });
  }, [clearMoreCloseTimer]);

  const closeMore = useCallback(() => {
    setIsMoreOpen(false);
    clearMoreCloseTimer();
    moreCloseTimerRef.current = window.setTimeout(() => {
      setIsMoreMounted(false);
      moreCloseTimerRef.current = null;
      moreButtonRef.current?.focus();
    }, 280);
  }, [clearMoreCloseTimer]);

  const toggleMore = useCallback(() => {
    if (isMoreOpen) {
      closeMore();
      return;
    }
    openMore();
  }, [closeMore, isMoreOpen, openMore]);

  useLayoutEffect(() => {
    updateNavIndicator();
  }, [updateNavIndicator, isCollapsed]);

  useEffect(() => {
    const list = navListRef.current;
    if (!list) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateNavIndicator();
    });
    observer.observe(list);
    window.addEventListener("resize", updateNavIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateNavIndicator);
    };
  }, [updateNavIndicator]);

  useEffect(() => {
    if (!navIndicator || navIndicatorReady) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setNavIndicatorReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [navIndicator, navIndicatorReady]);

  useEffect(() => {
    return () => {
      clearMoreCloseTimer();
    };
  }, [clearMoreCloseTimer]);

  useEffect(() => {
    clearMoreCloseTimer();
    setPendingHref(null);
    setIsMoreOpen(false);
    setIsMoreMounted(false);
  }, [pathname, clearMoreCloseTimer]);

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMore();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMore, isMoreOpen]);

  function toggleCollapsed() {
    const next = !readCollapsedPreference();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    emitSidebarCollapseChange();
  }

  const moreSheet =
    isMoreMounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.moreOverlay}
            data-open={isMoreOpen ? "true" : "false"}
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeMore();
              }
            }}
          >
            <div
              id={moreSheetId}
              className={styles.moreSheet}
              data-open={isMoreOpen ? "true" : "false"}
              role="dialog"
              aria-modal="true"
              aria-label="Más opciones"
            >
              <nav aria-label="Todas las secciones">
                <ul className={styles.moreList}>
                  {navItems.map((item) => (
                    <li key={item.href}>
                      <AdminNavItem
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={isNavItemActive(pathname, item.href)}
                        isPending={pendingHref === item.href}
                        variant="sheet"
                        onNavigate={() => {
                          setPendingHref(item.href);
                          closeMore();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
              <div className={styles.moreFooter}>
                <AdminSignOutButton variant="sheet" />
                <button
                  type="button"
                  className={styles.moreCloseButton}
                  aria-label="Cerrar menú"
                  onClick={closeMore}
                >
                  <X strokeWidth={ICON_STROKE} aria-hidden />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <nav
        className={styles.mobileDock}
        aria-label="Panel de administración"
        data-admin-mobile-dock
        style={
          {
            "--dock-cols": String(dockItems.length + 1),
          } as CSSProperties
        }
      >
        <div className={styles.mobileDockInner}>
          <ul className={styles.mobileDockList}>
            {dockItems.map((item) => (
              <li key={item.href}>
                <AdminNavItem
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isNavItemActive(pathname, item.href)}
                  isPending={pendingHref === item.href}
                  variant="dock"
                  onNavigate={() => setPendingHref(item.href)}
                />
              </li>
            ))}
            <li>
              <button
                ref={moreButtonRef}
                type="button"
                className={`${styles.moreDockButton} ${isMoreOpen || isOverflowRouteActive ? styles.moreDockButtonActive : ""}`}
                aria-label="Más opciones"
                aria-expanded={isMoreOpen}
                aria-controls={isMoreMounted ? moreSheetId : undefined}
                onClick={toggleMore}
              >
                <Ellipsis
                  className={styles.moreDockIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <span className={styles.moreDockLabel}>Más</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
      {moreSheet}

      <div
        className={styles.sidebarShell}
        data-collapsed={isCollapsed ? "true" : "false"}
      >
        <aside className={styles.sidebar} aria-label="Panel de administración">
          <div className={styles.top}>
            <div className={styles.logoWrap}>
              <AdminLogo isCollapsed={isCollapsed} />
            </div>

            <nav className={styles.nav} aria-label="Secciones del administrador">
              <ul
                ref={navListRef}
                className={styles.navList}
                data-indicator={
                  !navIndicator ? "off" : navIndicatorReady ? "ready" : "placed"
                }
                style={
                  navIndicator
                    ? ({
                        "--nav-indicator-top": `${navIndicator.top}px`,
                        "--nav-indicator-height": `${navIndicator.height}px`,
                      } as CSSProperties)
                    : undefined
                }
              >
                {navItems.map((item) => (
                  <li key={item.href}>
                    <AdminNavItem
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={isNavItemActive(pathname, item.href)}
                      isPending={pendingHref === item.href}
                      isCollapsed={isCollapsed}
                      onNavigate={() => setPendingHref(item.href)}
                    />
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className={styles.userArea}>
            <div className={styles.userRow}>
              <RoleIcon
                className={`${styles.roleIcon} ${isAdmin ? styles.roleIconAdmin : styles.roleIconUser}`}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              <div className={styles.userMeta}>
                <span
                  className={`${styles.userRole} ${isAdmin ? styles.userRoleAdmin : styles.userRoleUser}`}
                >
                  {roleLabel}
                </span>
                <span className={styles.userEmail} title={userEmail}>
                  {userEmail}
                </span>
              </div>
            </div>
            <AdminSignOutButton variant="sidebar" isCollapsed={isCollapsed} />
          </div>
        </aside>

        <button
          type="button"
          className={styles.expandStrip}
          onClick={toggleCollapsed}
          aria-label={
            isCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"
          }
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
          )}
        </button>
      </div>
    </>
  );
}
