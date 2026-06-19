import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText } from "@/shared/icons";

export type AdminNavItemConfig = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/catalogos",
    label: "Catálogos",
    icon: BookOpen,
  },
  {
    href: "/admin/archivos",
    label: "Archivos",
    icon: FileText,
  },
];

export const ADMIN_USER_EMAIL_FALLBACK = "admin@rothamelrepuestos.com.ar";
