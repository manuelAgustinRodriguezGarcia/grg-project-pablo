import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import {
  buildLibroIvaRows,
  libroIvaNoteFiscalStatus,
  type LibroIvaRow,
} from "@/features/billing/utils/libro-iva";
import { resolveInvoicePdfIssuer } from "@/server/pdf/invoice-pdf-issuer";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";

export type LibroIvaSource = {
  rows: LibroIvaRow[];
  issuer: InvoicePdfIssuer;
  environment: BillingFiscalEnvironment;
  ivaPercent: number;
  pointOfSale: string;
};

/**
 * Misma carga que usa el Libro de IVA. El rango lo define el llamador
 * con las funciones de fecha ya existentes. Esta función no elige el período.
 */
export async function loadLibroIvaSource(range: {
  from: Date;
  to: Date;
}): Promise<LibroIvaSource> {
  const settings = await billingFiscalSettingsRepository.getOrCreate();
  const [invoices, notes] = await Promise.all([
    billingInvoiceRepository.findIssuedBetween(
      range.from,
      range.to,
      settings.environment,
    ),
    billingNoteRepository.findIssuedBetween(
      range.from,
      range.to,
      settings.environment,
    ),
  ]);

  const noteStatus = libroIvaNoteFiscalStatus(settings.environment);
  const rows = buildLibroIvaRows(
    invoices.map((invoice) => ({
      issuedAt: invoice.issuedAt,
      invoiceType: invoice.invoiceType,
      pointOfSale: invoice.pointOfSale,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientIdentificationType: invoice.clientIdentificationType,
      clientIdentificationNumber: invoice.clientIdentificationNumber,
      clientIvaCondition: invoice.clientIvaCondition,
      subtotal: invoice.subtotal.toNumber(),
      discountAmount: invoice.discountAmount.toNumber(),
      ivaPercent: invoice.ivaPercent.toNumber(),
      ivaAmount: invoice.ivaAmount.toNumber(),
      total: invoice.total.toNumber(),
      totalVisualRounded: invoice.totalVisualRounded.toNumber(),
    })),
    notes
      .filter((note) => note.fiscalStatus === noteStatus)
      .map((note) => ({
        kind: note.kind,
        issuedAt: note.issuedAt,
        invoiceType: note.invoiceType,
        pointOfSale: note.pointOfSale,
        noteNumber: note.noteNumber,
        invoiceNumber: note.invoice.invoiceNumber,
        clientName: note.clientName,
        clientIdentificationType: note.clientIdentificationType,
        clientIdentificationNumber: note.clientIdentificationNumber,
        clientIvaCondition: note.clientIvaCondition,
        netAmount: note.netAmount.toNumber(),
        ivaPercent: note.ivaPercent.toNumber(),
        ivaAmount: note.ivaAmount.toNumber(),
        amount: note.amount.toNumber(),
      })),
  );

  return {
    rows,
    issuer: resolveInvoicePdfIssuer(settings),
    environment: settings.environment,
    ivaPercent: settings.ivaPercent.toNumber(),
    pointOfSale: settings.pointOfSale,
  };
}
