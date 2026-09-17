import type {
  BillingInvoiceFiscalStatus,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { paymentStatusFromSaldoCents } from "@/features/billing/utils/receipt-allocation";

export function creditNoteCapCents(
  totalCents: number,
  creditCents: number,
  debitCents: number,
): number {
  return Math.max(0, totalCents - creditCents + debitCents);
}

export function invoiceOverpaymentCents(
  allocatedCents: number,
  payableCents: number,
): number {
  return Math.max(0, allocatedCents - payableCents);
}

export type AllocationReleasePlan = {
  deleteIds: string[];
  updates: Array<{ id: string; amountCents: number }>;
};

/** `allocations` must be newest-first so the latest imputación se libera primero. */
export function planOverallocationRelease(
  allocations: Array<{ id: string; amountCents: number }>,
  excessCents: number,
): AllocationReleasePlan {
  const deleteIds: string[] = [];
  const updates: Array<{ id: string; amountCents: number }> = [];
  let leftover = Math.max(0, excessCents);

  for (const row of allocations) {
    if (leftover <= 0) {
      break;
    }

    if (row.amountCents <= leftover) {
      deleteIds.push(row.id);
      leftover -= row.amountCents;
      continue;
    }

    updates.push({ id: row.id, amountCents: row.amountCents - leftover });
    leftover = 0;
  }

  return { deleteIds, updates };
}

export function invoiceOutstandingCents(
  totalCents: number,
  creditCents: number,
  debitCents: number,
  allocatedCents: number,
): number {
  return Math.max(0, totalCents - creditCents + debitCents - allocatedCents);
}

export function invoiceFiscalStatusFromNotes(
  creditCents: number,
  debitCents: number,
  totalCents: number,
): BillingInvoiceFiscalStatus {
  if (creditCents > 0 && creditCents >= totalCents + debitCents) {
    return "ANULADA_NC";
  }

  if (debitCents > 0) {
    return "AJUSTADA_ND";
  }

  if (creditCents > 0) {
    return "AJUSTADA_NC";
  }

  return "MODO_PRUEBA";
}

export function invoicePaymentStatusFromSettlement(
  fiscalStatus: BillingInvoiceFiscalStatus,
  outstandingCents: number,
  totalCents: number,
  paymentMethod: BillingPaymentMethod,
): BillingPaymentStatus {
  if (fiscalStatus === "ANULADA_NC") {
    return "ANULADA";
  }

  if (paymentMethod !== "CUENTA_CORRIENTE") {
    return "PAGA";
  }

  return paymentStatusFromSaldoCents(outstandingCents, totalCents);
}

export function effectiveInvoicePaymentStatus(
  paymentMethod: BillingPaymentMethod,
  paymentStatus: BillingPaymentStatus,
  fiscalStatus: BillingInvoiceFiscalStatus,
): BillingPaymentStatus {
  if (fiscalStatus === "ANULADA_NC") {
    return "ANULADA";
  }

  if (paymentMethod !== "CUENTA_CORRIENTE") {
    return "PAGA";
  }

  return paymentStatus;
}

export function splitGrossIvaCents(
  grossCents: number,
  ivaPercent: number,
): { netCents: number; ivaCents: number } {
  const netCents = Math.round((grossCents * 100) / (100 + ivaPercent));
  return {
    netCents,
    ivaCents: grossCents - netCents,
  };
}
