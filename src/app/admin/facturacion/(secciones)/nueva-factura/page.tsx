import type { Metadata } from "next";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { getBillingFiscalContextAction } from "@/features/billing/actions/billing-invoice.actions";
import { listBillingRubrosAction } from "@/features/billing/actions/billing-rubro.actions";
import { NewInvoiceManager } from "@/features/billing/components/invoices/NewInvoiceManager";
import type { BillingFiscalContext } from "@/features/billing/types/billing-invoice.types";
import { requireAdminOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Nueva factura",
};

const FALLBACK_FISCAL_CONTEXT: BillingFiscalContext = {
  ivaPercent: 21,
  genericClientLimit: 400_000,
  pointOfSale: "0007",
  environment: "MODO_PRUEBA",
};

export default async function FacturacionNuevaFacturaPage() {
  await requireAdminOrRedirect("/admin");

  const [clientsResult, rubrosResult, fiscalResult] = await Promise.all([
    listBillingClientsAction(),
    listBillingRubrosAction(),
    getBillingFiscalContextAction(),
  ]);

  return (
    <NewInvoiceManager
      initialClients={clientsResult.success ? clientsResult.data : []}
      initialRubros={rubrosResult.success ? rubrosResult.data : []}
      fiscalContext={
        fiscalResult.success ? fiscalResult.data : FALLBACK_FISCAL_CONTEXT
      }
    />
  );
}
