import type { LucideIcon } from "lucide-react";
import { Archive, TableProperties } from "@/shared/icons";

export type AdminNavItemConfig = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/catalogos",
    label: "Catálogos",
    icon: TableProperties,
  },
  {
    href: "/admin/archivos",
    label: "Archivos",
    icon: Archive,
  },
];

export const ADMIN_USER_EMAIL_FALLBACK = "admin@rothamelrepuestos.com.ar";
