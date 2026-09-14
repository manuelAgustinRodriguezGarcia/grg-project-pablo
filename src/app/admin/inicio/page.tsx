import type { Metadata } from "next";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { DashboardView } from "@/features/billing/components/dashboard/DashboardView";
import { requireAdminOrRedirect } from "@/server/auth";
import { dashboardService } from "@/server/services/dashboard.service";

export const metadata: Metadata = {
  title: "Inicio",
};

export default async function AdminInicioPage() {
  await requireAdminOrRedirect("/admin/inicio");
  const [{ lastCatalog, lastPriceList }, invoicesResult] = await Promise.all([
    dashboardService.getRecentSummaries(),
    listBillingInvoicesAction(),
  ]);

  return (
    <DashboardView
      lastCatalog={lastCatalog}
      lastPriceList={lastPriceList}
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
    />
  );
}
