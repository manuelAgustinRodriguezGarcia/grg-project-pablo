"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AdminSignOutButton } from "@/features/auth/components/AdminSignOutButton";
import { ADMIN_NAV_ITEMS } from "@/features/admin/data/adminNav";
import { ChevronLeft, ChevronRight, ShieldUser, UserRound, ICON_STROKE } from "@/shared/icons";
import type { UserRole } from "@/generated/prisma/client";
import { AdminLogo } from "./AdminLogo";
import { AdminNavItem } from "./AdminNavItem";
import styles from "./AdminSidebar.module.scss";

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

type AdminSidebarProps = {
  userEmail: string;
  userRole: UserRole;
};

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const RoleIcon = isAdmin ? ShieldUser : UserRound;
  const roleLabel = isAdmin ? "Administrador" : "Usuario";
  const isCollapsed = useSyncExternalStore(
    subscribeSidebarCollapse,
    getSidebarCollapseSnapshot,
    getSidebarCollapseServerSnapshot,
  );

  function toggleCollapsed() {
    const next = !readCollapsedPreference();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    emitSidebarCollapseChange();
  }

  return (
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
            <ul className={styles.navList}>
              {ADMIN_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <AdminNavItem
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isNavItemActive(pathname, item.href)}
                    isCollapsed={isCollapsed}
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
        className={styles.collapseToggle}
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
        ) : (
          <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
        )}
      </button>
    </div>
  );
}
