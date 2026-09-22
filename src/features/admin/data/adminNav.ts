import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/shared/auth/permissions";
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
  permission: Permission;
};

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
    permission: "dashboard.read",
  },
  {
    href: "/admin/catalogos",
    label: "Catálogos",
    icon: TableProperties,
    permission: "catalogs.read",
  },
  {
    href: "/admin/precios",
    label: "Precios",
    icon: CircleDollarSign,
    permission: "prices.read",
  },
  {
    href: "/admin/facturacion",
    label: "Facturación",
    icon: ReceiptText,
    permission: "invoices.read",
  },
  {
    href: "/admin/archivos",
    label: "Archivos",
    icon: Archive,
    permission: "files.read",
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: Users,
    permission: "users.manage",
  },
];

export const ADMIN_USER_EMAIL_FALLBACK = "admin@rothamelrepuestos.com.ar";
