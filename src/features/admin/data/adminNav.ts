import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CircleDollarSign,
  House,
  ReceiptText,
  TableProperties,
  Users,
} from "@/shared/icons";

export type AdminNavItemConfig = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visible only when session role is ADMIN. */
  adminOnly?: boolean;
};

/** Hrefs visibles en el dock móvil (el resto vive en el sheet “Más”). */
export const ADMIN_MOBILE_DOCK_HREFS = [
  "/admin/inicio",
  "/admin/catalogos",
  "/admin/precios",
  "/admin/facturacion",
] as const;

export const ADMIN_NAV_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/inicio",
    label: "Inicio",
    icon: House,
    adminOnly: true,
  },
  {
    href: "/admin/catalogos",
    label: "Catálogos",
    icon: TableProperties,
  },
  {
    href: "/admin/precios",
    label: "Precios",
    icon: CircleDollarSign,
  },
  {
    href: "/admin/facturacion",
    label: "Facturación",
    icon: ReceiptText,
    adminOnly: true,
  },
  {
    href: "/admin/archivos",
    label: "Archivos",
    icon: Archive,
    adminOnly: true,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    adminOnly: true,
  },
];

export const ADMIN_USER_EMAIL_FALLBACK = "admin@rothamelrepuestos.com.ar";
