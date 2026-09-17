import type { Metadata } from "next";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { BillingHub } from "@/features/billing/components/BillingHub";

export const metadata: Metadata = {
  title: "Facturación",
};

export default async function FacturacionHubPage() {
  const invoicesResult = await listBillingInvoicesAction();

  return (
    <BillingHub
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
    />
  );
}
