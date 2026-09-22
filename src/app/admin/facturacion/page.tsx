import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { BillingHub } from "@/features/billing/components/BillingHub";
import {
  BILLING_INVOICES_PATH,
  BILLING_NEW_INVOICE_PATH,
} from "@/features/billing/data/billingNav";
import { requireAuthOrRedirect } from "@/server/auth";
import { hasPermission } from "@/shared/auth/permissions";

export const metadata: Metadata = {
  title: "Facturación",
};

export default async function FacturacionHubPage() {
  const auth = await requireAuthOrRedirect("/admin/facturacion");

  if (!hasPermission(auth.profile.role, "billing.hub.read")) {
    if (hasPermission(auth.profile.role, "invoices.create")) {
      redirect(BILLING_NEW_INVOICE_PATH);
    }
    if (hasPermission(auth.profile.role, "invoices.read")) {
      redirect(BILLING_INVOICES_PATH);
    }
    redirect("/admin/catalogos");
  }

  const invoicesResult = await listBillingInvoicesAction();

  return (
    <BillingHub
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
    />
  );
}
