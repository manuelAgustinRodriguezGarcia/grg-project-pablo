import type { DashboardQuickLink } from "@/features/billing/data/dashboardTypes";

export const DASHBOARD_CREATE_CATALOG_HREF = "/admin/catalogos?nuevo=1";

export const DASHBOARD_QUICK_LINKS: readonly DashboardQuickLink[] = [
  { href: "/admin/facturacion/nueva-factura", label: "Nueva factura" },
  { href: DASHBOARD_CREATE_CATALOG_HREF, label: "Subir catálogo" },
];
