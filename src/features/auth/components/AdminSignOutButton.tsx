"use client";

import { logoutFormAction } from "@/features/auth/actions/logout-form.action";
import { LogOut, ICON_STROKE } from "@/shared/icons";
import styles from "./AdminSignOutButton.module.scss";

type AdminSignOutButtonProps = {
  variant?: "default" | "sidebar";
};

export function AdminSignOutButton({
  variant = "default",
}: AdminSignOutButtonProps) {
  const isSidebar = variant === "sidebar";

  return (
    <form
      action={logoutFormAction}
      className={isSidebar ? styles.formSidebar : styles.form}
    >
      <button
        type="submit"
        className={isSidebar ? styles.buttonSidebar : styles.button}
      >
        <LogOut className={styles.icon} strokeWidth={ICON_STROKE} aria-hidden />
        <span>Cerrar sesión</span>
      </button>
    </form>
  );
}
