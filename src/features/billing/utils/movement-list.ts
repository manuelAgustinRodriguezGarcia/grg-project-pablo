import type {
  BillingNoteKind,
  BillingReceiptPaymentMethod,
} from "@/generated/prisma/client";
import type { BillingNoteListItem } from "@/features/billing/types/billing-note.types";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import { issuedAtToIsoDateOnly } from "@/features/billing/utils/invoice-list";
import { formatReceiptNumber } from "@/features/billing/utils/receipt-number";
import type { ReceiptAllocationStatus } from "@/features/billing/utils/receipt-allocation";

export type BillingMovementKind = "RECEIPT" | "CREDIT_NOTE" | "DEBIT_NOTE";

export type BillingMovementInvoiceLink = {
  id: string;
  label: string;
};

export type BillingMovementListItem = {
  id: string;
  kind: BillingMovementKind;
  number: string;
  issuedAt: Date;
  amount: number;
  remainingAmount: number;
  allocationStatus: ReceiptAllocationStatus | null;
  paymentMethod: BillingReceiptPaymentMethod | null;
  clientId: string | null;
  clientName: string;
  invoiceId: string | null;
  invoices: BillingMovementInvoiceLink[];
  invoiceNumbers: string;
  notes: string | null;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  printedAt: Date | null;
  downloadedAt: Date | null;
  sharedAt: Date | null;
};

export type MovementListFilters = {
  query: string;
  kind: "all" | BillingMovementKind;
  fromDate: string;
  toDate: string;
};

export function movementKindLabel(kind: BillingMovementKind): string {
  switch (kind) {
    case "RECEIPT":
      return "Recibo";
    case "CREDIT_NOTE":
      return "Nota de crédito";
    case "DEBIT_NOTE":
      return "Nota de débito";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function movementKindEmptyCopy(kind: BillingMovementKind): string {
  switch (kind) {
    case "RECEIPT":
      return "Todavía no hay recibos. Emitilos acá o desde una factura impaga.";
    case "CREDIT_NOTE":
      return "Todavía no hay notas de crédito. Emitilas acá o desde el detalle de una factura.";
    case "DEBIT_NOTE":
      return "Todavía no hay notas de débito. Emitilas acá o desde el detalle de una factura.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function associatedInvoices(
  allocations: BillingReceiptListItem["allocations"],
): BillingMovementInvoiceLink[] {
  return allocations.map((allocation) => ({
    id: allocation.invoiceId,
    label: `${allocation.invoiceType} ${allocation.invoiceNumber}`,
  }));
}

export function associatedInvoicesLabel(
  allocations: BillingReceiptListItem["allocations"],
): string {
  if (allocations.length === 0) {
    return "A cuenta";
  }

  return associatedInvoices(allocations)
    .map((invoice) => invoice.label)
    .join(" ");
}

function sortMovements(
  movements: BillingMovementListItem[],
): BillingMovementListItem[] {
  return [...movements].sort((left, right) => {
    const byDate =
      new Date(right.issuedAt).getTime() - new Date(left.issuedAt).getTime();
    if (byDate !== 0) {
      return byDate;
    }
    return right.number.localeCompare(left.number, "es-AR");
  });
}

export function noteMovementKind(
  kind: BillingNoteKind,
): Extract<BillingMovementKind, "CREDIT_NOTE" | "DEBIT_NOTE"> {
  switch (kind) {
    case "CREDIT":
      return "CREDIT_NOTE";
    case "DEBIT":
      return "DEBIT_NOTE";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function buildReceiptMovements(
  receipts: BillingReceiptListItem[],
): BillingMovementListItem[] {
  return sortMovements(
    receipts.map((receipt) => ({
      id: receipt.id,
      kind: "RECEIPT" as const,
      number: formatReceiptNumber(receipt.receiptNumber),
      issuedAt: receipt.issuedAt,
      amount: receipt.amount,
      remainingAmount: receipt.remainingAmount,
      allocationStatus: receipt.allocationStatus,
      paymentMethod: receipt.paymentMethod,
      clientId: receipt.clientId,
      clientName: receipt.clientName,
      invoiceId:
        receipt.allocations.length === 1
          ? (receipt.allocations[0]?.invoiceId ?? null)
          : null,
      invoices: associatedInvoices(receipt.allocations),
      invoiceNumbers: associatedInvoicesLabel(receipt.allocations),
      notes: receipt.notes,
      clientEmail: receipt.clientEmail,
      clientWhatsapp: receipt.clientWhatsapp,
      printedAt: receipt.printedAt,
      downloadedAt: receipt.downloadedAt,
      sharedAt: receipt.sharedAt,
    })),
  );
}

export function buildNoteMovements(
  notes: BillingNoteListItem[],
): BillingMovementListItem[] {
  return notes.map((note) => ({
    id: note.id,
    kind: noteMovementKind(note.kind),
    number: note.noteNumber,
    issuedAt: note.issuedAt,
    amount: note.amount,
    remainingAmount: 0,
    allocationStatus: null,
    paymentMethod: null,
    clientId: note.clientId,
    clientName: note.clientName,
    invoiceId: note.invoiceId,
    invoices: [
      {
        id: note.invoiceId,
        label: `${note.invoiceType} ${note.invoiceNumber}`,
      },
    ],
    invoiceNumbers: `${note.invoiceType} ${note.invoiceNumber}`,
    notes: note.reason,
    clientEmail: null,
    clientWhatsapp: null,
    printedAt: note.printedAt,
    downloadedAt: note.downloadedAt,
    sharedAt: note.sharedAt,
  }));
}

export function buildBillingMovements(
  receipts: BillingReceiptListItem[],
  notes: BillingNoteListItem[],
): BillingMovementListItem[] {
  return sortMovements([
    ...buildReceiptMovements(receipts),
    ...buildNoteMovements(notes),
  ]);
}

export function movementMatchesDateRange(
  movement: Pick<BillingMovementListItem, "issuedAt">,
  fromDate: string,
  toDate: string,
): boolean {
  const issuedDate = issuedAtToIsoDateOnly(movement.issuedAt);

  if (fromDate && issuedDate < fromDate) {
    return false;
  }

  if (toDate && issuedDate > toDate) {
    return false;
  }

  return true;
}

export function movementMatchesSearch(
  movement: BillingMovementListItem,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  if (!normalizedQuery) {
    return true;
  }

  return (
    movement.number.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    movement.clientName.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    movement.invoiceNumbers.toLocaleLowerCase("es-AR").includes(normalizedQuery)
  );
}

export function filterMovementList(
  movements: BillingMovementListItem[],
  filters: MovementListFilters,
): BillingMovementListItem[] {
  return movements.filter((movement) => {
    if (filters.kind !== "all" && movement.kind !== filters.kind) {
      return false;
    }

    if (!movementMatchesDateRange(movement, filters.fromDate, filters.toDate)) {
      return false;
    }

    return movementMatchesSearch(movement, filters.query);
  });
}
