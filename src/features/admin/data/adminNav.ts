import type { LucideIcon } from "lucide-react";
import { Archive, Receipt, TableProperties, Users } from "@/shared/icons";

export type AdminNavItemConfig = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visible only when session role is ADMIN. */
  adminOnly?: boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/catalogos",
    label: "Catálogos",
    icon: TableProperties,
  },
  {
    href: "/admin/precios",
    label: "Precios",
    icon: Receipt,
  },
  {
    href: "/admin/archivos",
    label: "Archivos",
    icon: Archive,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    adminOnly: true,
  },
];

export const ADMIN_USER_EMAIL_FALLBACK = "admin@rothamelrepuestos.com.ar";
