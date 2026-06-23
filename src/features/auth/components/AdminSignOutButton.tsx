"use client";

import { LogOut, ICON_STROKE } from "@/shared/icons";
import styles from "./AdminSignOutButton.module.scss";

const LOGOUT_PATH = "/api/auth/logout";

type AdminSignOutButtonProps = {
  variant?: "default" | "sidebar";
  isCollapsed?: boolean;
};

export function AdminSignOutButton({
  variant = "default",
  isCollapsed = false,
}: AdminSignOutButtonProps) {
  const isSidebar = variant === "sidebar";

  return (
    <form
      action={LOGOUT_PATH}
      method="POST"
      className={isSidebar ? styles.formSidebar : styles.form}
    >
      <button
        type="submit"
        className={`${isSidebar ? styles.buttonSidebar : styles.button} ${isSidebar && isCollapsed ? styles.buttonSidebarCollapsed : ""}`}
        title={isSidebar && isCollapsed ? "Cerrar sesión" : undefined}
      >
        <LogOut className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
        <span className={styles.label}>Cerrar sesión</span>
      </button>
    </form>
  );
}
