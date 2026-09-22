import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { listBillingRubrosAction } from "@/features/billing/actions/billing-rubro.actions";
import { RubrosManager } from "@/features/billing/components/rubros/RubrosManager";
import { requirePermissionOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Rubros",
};

export default async function FacturacionRubrosPage() {
  const auth = await requirePermissionOrRedirect("categories.read", "/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const [rubrosResult, invoicesResult] = await Promise.all([
    listBillingRubrosAction(),
    listBillingInvoicesAction(),
  ]);

  return (
    <RubrosManager
      initialRubros={rubrosResult.success ? rubrosResult.data : []}
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      canManage={adminAuth.canManageCategories}
    />
  );
}
