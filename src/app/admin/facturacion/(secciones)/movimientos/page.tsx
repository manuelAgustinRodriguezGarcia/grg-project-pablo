import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { listBillingClientsAction } from "@/features/billing/actions/billing-client.actions";
import { listBillingInvoicesAction } from "@/features/billing/actions/billing-invoice.actions";
import { listBillingNotesAction } from "@/features/billing/actions/billing-note.actions";
import { listBillingReceiptsAction } from "@/features/billing/actions/billing-receipt.actions";
import { MovimientosManager } from "@/features/billing/components/movimientos/MovimientosManager";
import { requirePermissionOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Movimientos",
};

export default async function FacturacionMovimientosPage() {
  const auth = await requirePermissionOrRedirect("movements.read", "/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const [invoicesResult, receiptsResult, notesResult, clientsResult] =
    await Promise.all([
      listBillingInvoicesAction(),
      listBillingReceiptsAction(),
      listBillingNotesAction(),
      listBillingClientsAction(),
    ]);

  return (
    <MovimientosManager
      initialInvoices={invoicesResult.success ? invoicesResult.data : []}
      initialReceipts={receiptsResult.success ? receiptsResult.data : []}
      initialNotes={notesResult.success ? notesResult.data : []}
      clients={clientsResult.success ? clientsResult.data : []}
      canManageMovements={adminAuth.canManageMovements}
    />
  );
}
