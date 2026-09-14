import type {
  BillingInvoiceType,
  BillingReceiptPaymentMethod,
} from "@/generated/prisma/client";
import {
  receiptAllocationStatus,
  remainingCents,
  type ReceiptAllocationStatus,
} from "@/features/billing/utils/receipt-allocation";
import { formatReceiptNumber } from "@/features/billing/utils/receipt-number";
import type { BillingReceiptWithRelations } from "@/server/repositories/billing-receipt.repository";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

export type BillingReceiptActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export const RECEIPT_PAYMENT_METHOD_ORDER: readonly BillingReceiptPaymentMethod[] =
  ["EFECTIVO", "CHEQUE", "TRANSFERENCIA", "TARJETA", "OTROS"];

export const RECEIPT_PAYMENT_METHOD_LABELS: Record<
  BillingReceiptPaymentMethod,
  string
> = {
  EFECTIVO: "Efectivo",
  CHEQUE: "Cheque",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTROS: "Otros",
};

export const RECEIPT_ALLOCATION_STATUS_LABELS: Record<
  ReceiptAllocationStatus,
  string
> = {
  A_CUENTA: "A cuenta",
  PARCIAL: "Parcialmente imputado",
  IMPUTADO: "Imputado",
};

export type BillingReceiptAllocationView = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: BillingInvoiceType;
  amount: number;
};

export type BillingInvoiceReceiptView = {
  id: string;
  receiptNumber: string;
  issuedAt: Date;
  amount: number;
  allocatedToInvoice: number;
  createdByName: string;
};

export type BillingReceiptListItem = {
  id: string;
  receiptNumber: string;
  issuedAt: Date;
  amount: number;
  allocatedAmount: number;
  remainingAmount: number;
  allocationStatus: ReceiptAllocationStatus;
  paymentMethod: BillingReceiptPaymentMethod;
  notes: string | null;
  createdByName: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  allocations: BillingReceiptAllocationView[];
  printedAt: Date | null;
  downloadedAt: Date | null;
  sharedAt: Date | null;
};

export function toBillingReceiptListItem(
  receipt: BillingReceiptWithRelations,
): BillingReceiptListItem {
  const amountCents = pesosToCents(receipt.amount.toNumber());
  const allocatedCents = pesosToCents(
    receipt.allocations.reduce(
      (sum, allocation) => sum + allocation.amount.toNumber(),
      0,
    ),
  );

  return {
    id: receipt.id,
    receiptNumber: formatReceiptNumber(receipt.receiptNumber),
    issuedAt: receipt.issuedAt,
    amount: receipt.amount.toNumber(),
    allocatedAmount: centsToPesos(allocatedCents),
    remainingAmount: centsToPesos(remainingCents(amountCents, allocatedCents)),
    allocationStatus: receiptAllocationStatus(amountCents, allocatedCents),
    paymentMethod: receipt.paymentMethod,
    notes: receipt.notes,
    createdByName: receipt.createdBy.name,
    clientId: receipt.clientId,
    clientName: receipt.client.name,
    clientEmail: receipt.client.email,
    clientWhatsapp: receipt.client.whatsapp,
    allocations: receipt.allocations.map((allocation) => ({
      invoiceId: allocation.invoice.id,
      invoiceNumber: allocation.invoice.invoiceNumber,
      invoiceType: allocation.invoice.invoiceType,
      amount: allocation.amount.toNumber(),
    })),
    printedAt: receipt.printedAt,
    downloadedAt: receipt.downloadedAt,
    sharedAt: receipt.sharedAt,
  };
}
