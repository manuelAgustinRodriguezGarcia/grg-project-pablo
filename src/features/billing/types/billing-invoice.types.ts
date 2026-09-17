import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoice,
  BillingInvoiceFiscalStatus,
  BillingInvoiceItem,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNote,
  BillingNoteKind,
  BillingPaymentMethod,
  BillingPaymentStatus,
  BillingReceipt,
  BillingReceiptAllocation,
  User,
} from "@/generated/prisma/client";

export type { BillingInvoiceFiscalStatus, BillingPaymentStatus };
import type { BillingInvoiceReceiptView } from "@/features/billing/types/billing-receipt.types";
import { formatReceiptNumber } from "@/features/billing/utils/receipt-number";
import { pesosToCents, centsToPesos } from "@/shared/utils/billing-invoice-totals";
import { paymentStatusFromSaldoCents } from "@/features/billing/utils/receipt-allocation";
import {
  creditNoteCapCents,
  effectiveInvoicePaymentStatus,
  invoiceOutstandingCents,
} from "@/features/billing/utils/invoice-settlement";

export type BillingInvoiceActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export const INVOICE_TYPE_LABELS: Record<BillingInvoiceType, string> = {
  A: "Factura A",
  B: "Factura B",
};

export const PAYMENT_METHOD_ORDER: readonly BillingPaymentMethod[] = [
  "CONTADO_EFECTIVO",
  "CONTADO",
  "TARJETA",
  "TRANSFERENCIA",
  "OTROS",
  "CUENTA_CORRIENTE",
];

export const INVOICE_CREATE_PAYMENT_METHODS: readonly BillingPaymentMethod[] = [
  "CONTADO",
  "TARJETA",
  "TRANSFERENCIA",
  "OTROS",
  "CUENTA_CORRIENTE",
];

export const PAYMENT_METHOD_LABELS: Record<BillingPaymentMethod, string> = {
  CONTADO_EFECTIVO: "Contado efectivo",
  CONTADO: "Contado",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  OTROS: "Otros",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

export function invoicePdfTipoFacturaLabel(
  method: BillingPaymentMethod,
): string {
  return method === "CUENTA_CORRIENTE" ? "CUENTA CORRIENTE" : "CONTADO";
}

export const PAYMENT_STATUS_LABELS: Record<BillingPaymentStatus, string> = {
  IMPAGA: "Impaga",
  PARCIALMENTE_PAGA: "Parcialmente pagada",
  PAGA: "Paga",
  ANULADA: "Anulada",
};

export const FISCAL_STATUS_LABELS: Record<BillingInvoiceFiscalStatus, string> =
  {
    MODO_PRUEBA: "Modo prueba",
    BORRADOR: "Borrador",
    PENDIENTE_EMISION: "Pendiente de emisión",
    ENVIANDO_ARCA: "Enviando a ARCA",
    AUTORIZADA: "Autorizada",
    RECHAZADA: "Rechazada",
    ERROR_TECNICO: "Error técnico",
    CANCELADA: "Cancelada",
    AJUSTADA_NC: "Ajustada N.C",
    AJUSTADA_ND: "Ajustada N.D",
    ANULADA_NC: "ANULADA N.C",
  };

export const FISCAL_ENVIRONMENT_LABELS = {
  MODO_PRUEBA: "Modo prueba interno",
  HOMOLOGACION: "Homologación ARCA",
  PRODUCCION: "Producción ARCA",
} as const satisfies Record<BillingFiscalEnvironment, string>;

/** Parámetros fiscales que necesita la UI de facturación (valores planos). */
export type BillingFiscalContext = {
  ivaPercent: number;
  genericClientLimit: number;
  pointOfSale: string;
  environment: BillingFiscalEnvironment;
};

export type BillingInvoiceItemView = {
  id: string;
  rubroId: string | null;
  rubroCode: string;
  rubroName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
};

/** Factura serializable para el cliente (importes como number, no Decimal). */
export type BillingInvoiceListItem = {
  id: string;
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  invoiceNumber: string;
  issuedAt: Date;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientProvince: string | null;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  totalVisualRounded: number;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
  items: BillingInvoiceItemView[];
  createdAt: Date;
  outstandingAmount: number;
  creditNoteCap: number;
  receipts: BillingInvoiceReceiptView[];
  billingNotes: BillingInvoiceNoteView[];
  printedAt: Date | null;
  downloadedAt: Date | null;
  sharedAt: Date | null;
};

export type BillingInvoiceNoteView = {
  id: string;
  kind: BillingNoteKind;
  noteNumber: string;
  issuedAt: Date;
  amount: number;
  reason: string;
  createdByName: string;
};

type BillingInvoiceWithItemsModel = BillingInvoice & {
  items: BillingInvoiceItem[];
  allocations?: Array<
    BillingReceiptAllocation & {
      receipt: BillingReceipt & { createdBy?: Pick<User, "name"> | null };
    }
  >;
  billingNotes?: Array<BillingNote & { createdBy?: Pick<User, "name"> | null }>;
};

export function toBillingInvoiceListItem(
  invoice: BillingInvoiceWithItemsModel,
): BillingInvoiceListItem {
  const allocatedAmount = (invoice.allocations ?? []).reduce(
    (sum, allocation) => sum + allocation.amount.toNumber(),
    0,
  );
  const creditAmount = (invoice.billingNotes ?? [])
    .filter((note) => note.kind === "CREDIT")
    .reduce((sum, note) => sum + note.amount.toNumber(), 0);
  const debitAmount = (invoice.billingNotes ?? [])
    .filter((note) => note.kind === "DEBIT")
    .reduce((sum, note) => sum + note.amount.toNumber(), 0);
  const totalCents = pesosToCents(invoice.totalVisualRounded.toNumber());
  const creditCents = pesosToCents(creditAmount);
  const debitCents = pesosToCents(debitAmount);
  const computedOutstandingCents = invoiceOutstandingCents(
    totalCents,
    creditCents,
    debitCents,
    pesosToCents(allocatedAmount),
  );
  const isOnAccount = invoice.paymentMethod === "CUENTA_CORRIENTE";
  const outstandingCents = isOnAccount ? computedOutstandingCents : 0;

  return {
    id: invoice.id,
    environment: invoice.environment,
    fiscalStatus: invoice.fiscalStatus,
    invoiceType: invoice.invoiceType,
    pointOfSale: invoice.pointOfSale,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    clientId: invoice.clientId,
    clientCode: invoice.clientCode,
    clientName: invoice.clientName,
    clientAddress: invoice.clientAddress,
    clientCity: invoice.clientCity,
    clientProvince: invoice.clientProvince,
    clientEmail: invoice.clientEmail,
    clientWhatsapp: invoice.clientWhatsapp,
    clientIdentificationType: invoice.clientIdentificationType,
    clientIdentificationNumber: invoice.clientIdentificationNumber,
    clientIvaCondition: invoice.clientIvaCondition,
    subtotal: invoice.subtotal.toNumber(),
    discountPercent: invoice.discountPercent.toNumber(),
    discountAmount: invoice.discountAmount.toNumber(),
    ivaPercent: invoice.ivaPercent.toNumber(),
    ivaAmount: invoice.ivaAmount.toNumber(),
    total: invoice.total.toNumber(),
    totalVisualRounded: invoice.totalVisualRounded.toNumber(),
    paymentMethod: invoice.paymentMethod,
    paymentStatus: effectiveInvoicePaymentStatus(
      invoice.paymentMethod,
      invoice.paymentStatus,
      invoice.fiscalStatus,
    ),
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      id: item.id,
      rubroId: item.rubroId,
      rubroCode: item.rubroCode,
      rubroName: item.rubroName,
      description: item.description,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
      sortOrder: item.sortOrder,
    })),
    createdAt: invoice.createdAt,
    outstandingAmount: centsToPesos(outstandingCents),
    creditNoteCap: centsToPesos(
      creditNoteCapCents(totalCents, creditCents, debitCents),
    ),
    receipts: (invoice.allocations ?? []).map((allocation) => ({
      id: allocation.receipt.id,
      receiptNumber: formatReceiptNumber(allocation.receipt.receiptNumber),
      issuedAt: allocation.receipt.issuedAt,
      amount: allocation.receipt.amount.toNumber(),
      allocatedToInvoice: allocation.amount.toNumber(),
      createdByName: allocation.receipt.createdBy?.name ?? "Administrador",
    })),
    billingNotes: (invoice.billingNotes ?? []).map((note) => ({
      id: note.id,
      kind: note.kind,
      noteNumber: note.noteNumber,
      issuedAt: note.issuedAt,
      amount: note.amount.toNumber(),
      reason: note.reason,
      createdByName: note.createdBy?.name ?? "Administrador",
    })),
    printedAt: invoice.printedAt,
    downloadedAt: invoice.downloadedAt,
    sharedAt: invoice.sharedAt,
  };
}

export function derivedInvoicePaymentStatus(
  totalVisualRounded: number,
  outstandingAmount: number,
): BillingPaymentStatus {
  return paymentStatusFromSaldoCents(
    pesosToCents(outstandingAmount),
    pesosToCents(totalVisualRounded),
  );
}
