import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { libroIvaNoteFiscalStatus } from "@/features/billing/utils/libro-iva";
import { prisma } from "@/server/database/prisma";
import type {
  StatisticsInvoiceRecord,
  StatisticsNoteRecord,
  StatisticsSource,
} from "@/server/services/billing-statistics/source";
import type { StatisticsRange } from "@/server/services/billing-statistics/periods";

const invoiceSelect = {
  id: true,
  issuedAt: true,
  invoiceNumber: true,
  clientId: true,
  clientCode: true,
  clientName: true,
  clientIdentificationType: true,
  clientIdentificationNumber: true,
  total: true,
  ivaAmount: true,
  totalVisualRounded: true,
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      rubroId: true,
      rubroCode: true,
      rubroName: true,
      quantity: true,
      lineTotal: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.BillingInvoiceSelect;

const noteSelect = {
  id: true,
  kind: true,
  issuedAt: true,
  noteNumber: true,
  invoiceId: true,
  clientId: true,
  clientCode: true,
  clientName: true,
  clientIdentificationType: true,
  clientIdentificationNumber: true,
  netAmount: true,
  ivaAmount: true,
  amount: true,
  invoice: {
    select: {
      invoiceNumber: true,
    },
  },
} satisfies Prisma.BillingNoteSelect;

/**
 * Lee solo los campos que el motor agrega.
 * Facturas: ambiente activo y fecha de emisión, sin filtrar estado.
 * Notas: el mismo estado fiscal que el Libro de IVA para ese ambiente.
 * No lee recibos, fichas vivas de clientes ni fichas vivas de rubros.
 *
 * Índices existentes: BillingInvoice(issuedAt), BillingNote(issuedAt).
 * No se agrega un índice compuesto: el filtro es igualdad de ambiente
 * más un rango de fechas, y el volumen no justifica una migración.
 */
export class BillingStatisticsRepository {
  async findSource(
    range: StatisticsRange,
    environment: BillingFiscalEnvironment,
  ): Promise<StatisticsSource> {
    const issuedAt = { gte: range.from, lt: range.to };
    const [invoices, notes] = await Promise.all([
      prisma.billingInvoice.findMany({
        where: { environment, issuedAt },
        select: invoiceSelect,
      }),
      prisma.billingNote.findMany({
        where: {
          environment,
          fiscalStatus: libroIvaNoteFiscalStatus(environment),
          issuedAt,
        },
        select: noteSelect,
      }),
    ]);

    return {
      invoices: invoices.map(toInvoiceRecord),
      notes: notes.map(toNoteRecord),
    };
  }
}

function toInvoiceRecord(
  invoice: Prisma.BillingInvoiceGetPayload<{ select: typeof invoiceSelect }>,
): StatisticsInvoiceRecord {
  return {
    id: invoice.id,
    issuedAt: invoice.issuedAt,
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    clientCode: invoice.clientCode,
    clientName: invoice.clientName,
    clientIdentificationType: invoice.clientIdentificationType,
    clientIdentificationNumber: invoice.clientIdentificationNumber,
    total: invoice.total.toFixed(2),
    ivaAmount: invoice.ivaAmount.toFixed(2),
    totalVisualRounded: invoice.totalVisualRounded.toFixed(2),
    items: invoice.items.map((item) => ({
      rubroId: item.rubroId,
      rubroCode: item.rubroCode,
      rubroName: item.rubroName,
      quantity: item.quantity.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
      sortOrder: item.sortOrder,
    })),
  };
}

function toNoteRecord(
  note: Prisma.BillingNoteGetPayload<{ select: typeof noteSelect }>,
): StatisticsNoteRecord {
  return {
    id: note.id,
    kind: note.kind,
    issuedAt: note.issuedAt,
    noteNumber: note.noteNumber,
    invoiceId: note.invoiceId,
    invoiceNumber: note.invoice.invoiceNumber,
    clientId: note.clientId,
    clientCode: note.clientCode,
    clientName: note.clientName,
    clientIdentificationType: note.clientIdentificationType,
    clientIdentificationNumber: note.clientIdentificationNumber,
    netAmount: note.netAmount.toFixed(2),
    ivaAmount: note.ivaAmount.toFixed(2),
    amount: note.amount.toFixed(2),
  };
}

export const billingStatisticsRepository = new BillingStatisticsRepository();
