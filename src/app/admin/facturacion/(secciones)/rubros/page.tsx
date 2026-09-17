import type { Metadata } from "next";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { listBillingRubrosAction } from "@/features/billing/actions/billing-rubro.actions";
import { RubrosManager } from "@/features/billing/components/rubros/RubrosManager";
import { requireAdminOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Rubros",
};

export default async function FacturacionRubrosPage() {
  await requireAdminOrRedirect("/admin");
  const [rubrosResult, invoicesResult] = await Promise.all([
    listBillingRubrosAction(),
    listBillingInvoicesAction(),
  ]);

  return (
    <RubrosManager
      initialRubros={rubrosResult.success ? rubrosResult.data : []}
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
    />
  );
}
