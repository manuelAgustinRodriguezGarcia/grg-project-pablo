"use client";

import { usePathname } from "next/navigation";
import { AdminSignOutButton } from "@/features/auth/components/AdminSignOutButton";
import { ADMIN_NAV_ITEMS } from "@/features/admin/data/adminNav";
import { User, ICON_STROKE } from "@/shared/icons";
import { AdminLogo } from "./AdminLogo";
import { AdminNavItem } from "./AdminNavItem";
import styles from "./AdminSidebar.module.scss";

type AdminSidebarProps = {
  userEmail: string;
};

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Panel de administración">
      <div className={styles.top}>
        <div className={styles.logoWrap}>
          <AdminLogo />
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
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.userArea}>
        <div className={styles.userRow}>
          <span className={styles.avatar} aria-hidden="true">
            <User className={styles.avatarIcon} strokeWidth={ICON_STROKE} />
          </span>
          <span className={styles.userEmail}>{userEmail}</span>
        </div>
        <AdminSignOutButton variant="sidebar" />
      </div>
    </aside>
  );
}
