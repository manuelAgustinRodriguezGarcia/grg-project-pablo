import type { ReceiptAllocationRow } from "@/features/billing/utils/receipt-allocation";

/** Prefill del atajo desde Facturas: tilda esa factura y deja el resto destildada. */
export function preselectInvoiceRows(
  rows: ReceiptAllocationRow[],
  invoiceId: string | null,
): ReceiptAllocationRow[] {
  if (!invoiceId) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    selected: row.invoiceId === invoiceId,
    applyLocked: false,
    applyCents: 0,
  }));
}
