import type { Metadata } from "next";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { DeudoresManager } from "@/features/billing/components/deudores/DeudoresManager";
import { requirePermissionOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Clientes con deuda",
};

export default async function FacturacionDeudoresPage() {
  await requirePermissionOrRedirect("debts.read", "/admin");
  const invoicesResult = await listBillingInvoicesAction();

  return (
    <DeudoresManager
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
    />
  );
}
