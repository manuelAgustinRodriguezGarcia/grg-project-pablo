"use client";

import { LogOut, ICON_STROKE } from "@/shared/icons";
import styles from "./AdminSignOutButton.module.scss";

const LOGOUT_PATH = "/api/auth/logout";

type AdminSignOutButtonProps = {
  variant?: "default" | "sidebar" | "dock";
  isCollapsed?: boolean;
};

export function AdminSignOutButton({
  variant = "default",
  isCollapsed = false,
}: AdminSignOutButtonProps) {
  const isSidebar = variant === "sidebar";
  const isDock = variant === "dock";

  return (
    <form
      action={LOGOUT_PATH}
      method="POST"
      className={
        isDock ? styles.formDock : isSidebar ? styles.formSidebar : styles.form
      }
    >
      <button
        type="submit"
        className={`${isDock ? styles.buttonDock : isSidebar ? styles.buttonSidebar : styles.button} ${isSidebar && isCollapsed ? styles.buttonSidebarCollapsed : ""}`}
        title={isSidebar && isCollapsed ? "Cerrar sesión" : undefined}
      >
        <LogOut className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
        <span className={styles.label}>Cerrar sesión</span>
      </button>
    </form>
  );
}
