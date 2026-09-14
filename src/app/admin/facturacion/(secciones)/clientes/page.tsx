import type { Metadata } from "next";
import { ClientsManager } from "@/features/billing/components/clients/ClientsManager";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import {
  BILLING_CLIENT_HISTORY_QUERY,
  BILLING_CLIENT_ID_QUERY,
} from "@/features/billing/data/billingNav";
import { requireAdminOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Clientes",
};

type FacturacionClientesPageProps = {
  searchParams: Promise<{
    [BILLING_CLIENT_ID_QUERY]?: string | string[];
    [BILLING_CLIENT_HISTORY_QUERY]?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function FacturacionClientesPage({
  searchParams,
}: FacturacionClientesPageProps) {
  await requireAdminOrRedirect("/admin");
  const params = await searchParams;
  const [clientsResult, invoicesResult] = await Promise.all([
    listBillingClientsAction(),
    listBillingInvoicesAction(),
  ]);

  return (
    <ClientsManager
      initialClients={clientsResult.success ? clientsResult.data : []}
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      openClientId={firstParam(params[BILLING_CLIENT_ID_QUERY]) || undefined}
      openClientHistory={firstParam(params[BILLING_CLIENT_HISTORY_QUERY]) === "1"}
    />
  );
}
