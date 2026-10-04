import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { ClientsManager } from "@/features/billing/components/clients/ClientsManager";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import {
  BILLING_CLIENT_HISTORY_QUERY,
  BILLING_CLIENT_ID_QUERY,
} from "@/features/billing/data/billingNav";
import { isArcaNoteProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { requirePermissionOrRedirect } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";

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
  const auth = await requirePermissionOrRedirect("clients.read", "/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const params = await searchParams;
  const [clientsResult, invoicesResult, fiscalSettings] = await Promise.all([
    listBillingClientsAction(),
    listBillingInvoicesAction(),
    billingFiscalSettingsRepository.getOrCreate(),
  ]);

  return (
    <ClientsManager
      initialClients={clientsResult.success ? clientsResult.data : []}
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      fiscalEnvironment={fiscalSettings.environment}
      noteProductionEmissionEnabled={isArcaNoteProductionEmissionEnabled()}
      openClientId={firstParam(params[BILLING_CLIENT_ID_QUERY]) || undefined}
      openClientHistory={firstParam(params[BILLING_CLIENT_HISTORY_QUERY]) === "1"}
      canCreateClient={adminAuth.canCreateClient}
      canUpdateClient={adminAuth.canUpdateClient}
      canDeleteClient={adminAuth.canDeleteClient}
      canManageMovements={adminAuth.canManageMovements}
    />
  );
}
