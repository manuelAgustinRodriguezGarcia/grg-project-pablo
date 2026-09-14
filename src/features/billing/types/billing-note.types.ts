import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";
import type { BillingNoteWithRelations } from "@/server/repositories/billing-note.repository";

export type BillingNoteActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export const NOTE_KIND_LABELS: Record<BillingNoteKind, string> = {
  CREDIT: "Nota de crédito",
  DEBIT: "Nota de débito",
};

export const NOTE_KIND_SHORT_LABELS: Record<BillingNoteKind, string> = {
  CREDIT: "N.C",
  DEBIT: "N.D",
};

export type BillingNoteListItem = {
  id: string;
  kind: BillingNoteKind;
  noteNumber: string;
  issuedAt: Date;
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: BillingInvoiceType;
  amount: number;
  netAmount: number;
  ivaAmount: number;
  reason: string;
  clientId: string | null;
  clientName: string;
  clientCode: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  createdByName: string;
  printedAt: Date | null;
  downloadedAt: Date | null;
  sharedAt: Date | null;
};

export function toBillingNoteListItem(
  note: BillingNoteWithRelations,
): BillingNoteListItem {
  return {
    id: note.id,
    kind: note.kind,
    noteNumber: note.noteNumber,
    issuedAt: note.issuedAt,
    invoiceId: note.invoiceId,
    invoiceNumber: note.invoice.invoiceNumber,
    invoiceType: note.invoiceType,
    amount: note.amount.toNumber(),
    netAmount: note.netAmount.toNumber(),
    ivaAmount: note.ivaAmount.toNumber(),
    reason: note.reason,
    clientId: note.clientId,
    clientName: note.clientName,
    clientCode: note.clientCode,
    clientIdentificationType: note.clientIdentificationType,
    clientIdentificationNumber: note.clientIdentificationNumber,
    clientIvaCondition: note.clientIvaCondition,
    createdByName: note.createdBy.name,
    printedAt: note.printedAt,
    downloadedAt: note.downloadedAt,
    sharedAt: note.sharedAt,
  };
}
