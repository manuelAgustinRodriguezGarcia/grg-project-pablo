import type { Metadata } from "next";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { ComprobantesManager } from "@/features/billing/components/invoices/ComprobantesManager";
import {
  BILLING_INVOICE_ID_QUERY,
  BILLING_PAYMENT_STATUS_QUERY,
} from "@/features/billing/data/billingNav";
import { isArcaNoteProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { requirePermissionOrRedirect } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";

export const metadata: Metadata = {
  title: "Facturas",
};

type FacturacionFacturasPageProps = {
  searchParams: Promise<{
    [BILLING_INVOICE_ID_QUERY]?: string | string[];
    [BILLING_PAYMENT_STATUS_QUERY]?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function FacturacionFacturasPage({
  searchParams,
}: FacturacionFacturasPageProps) {
  await requirePermissionOrRedirect("invoices.read", "/admin");
  const params = await searchParams;
  const [invoicesResult, clientsResult, fiscalSettings] = await Promise.all([
    listBillingInvoicesAction(),
    listBillingClientsAction(),
    billingFiscalSettingsRepository.getOrCreate(),
  ]);

  return (
    <ComprobantesManager
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      clients={clientsResult.success ? clientsResult.data : []}
      fiscalEnvironment={fiscalSettings.environment}
      noteProductionEmissionEnabled={isArcaNoteProductionEmissionEnabled()}
      openInvoiceId={firstParam(params[BILLING_INVOICE_ID_QUERY]) || undefined}
      initialPaymentStatus={
        firstParam(params[BILLING_PAYMENT_STATUS_QUERY]) || undefined
      }
    />
  );
}
