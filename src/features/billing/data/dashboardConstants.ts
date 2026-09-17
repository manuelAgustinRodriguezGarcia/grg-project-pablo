import type { DashboardQuickLink } from "@/features/billing/data/dashboardTypes";

export const DASHBOARD_QUICK_LINKS: readonly DashboardQuickLink[] = [
  { href: "/admin/facturacion/nueva-factura", label: "Nueva factura" },
  { href: "/admin/archivos", label: "Subir catálogo" },
];
