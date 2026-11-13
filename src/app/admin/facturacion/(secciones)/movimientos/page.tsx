import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { listBillingNotesAction } from "@/features/billing/actions/billing-note.actions";
import { listBillingReceiptsAction } from "@/features/billing/actions/billing-receipt.actions";
import { MovimientosManager } from "@/features/billing/components/movimientos/MovimientosManager";
import { BILLING_LIST_HIGHLIGHT_QUERY } from "@/features/billing/data/billingNav";
import { isArcaNoteProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { requirePermissionOrRedirect } from "@/server/auth";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";

export const metadata: Metadata = {
  title: "Movimientos",
};

type FacturacionMovimientosPageProps = {
  searchParams: Promise<{
    [BILLING_LIST_HIGHLIGHT_QUERY]?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function FacturacionMovimientosPage({
  searchParams,
}: FacturacionMovimientosPageProps) {
  const params = await searchParams;
  const auth = await requirePermissionOrRedirect("movements.read", "/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const [invoicesResult, receiptsResult, notesResult, clientsResult, fiscalSettings] =
    await Promise.all([
      listBillingInvoicesAction(),
      listBillingReceiptsAction(),
      listBillingNotesAction(),
      listBillingClientsAction(),
      billingFiscalSettingsRepository.getOrCreate(),
    ]);

  return (
    <MovimientosManager
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      initialReceipts={receiptsResult.success ? receiptsResult.data : []}
      initialNotes={notesResult.success ? notesResult.data : []}
      clients={clientsResult.success ? clientsResult.data : []}
      fiscalEnvironment={fiscalSettings.environment}
      noteProductionEmissionEnabled={isArcaNoteProductionEmissionEnabled()}
      canManageMovements={adminAuth.canManageMovements}
      canUpdateMovements={adminAuth.canUpdateMovements}
      highlightNoteId={firstParam(params[BILLING_LIST_HIGHLIGHT_QUERY]) || undefined}
    />
  );
}
