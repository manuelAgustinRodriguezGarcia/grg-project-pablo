import { requireAdmin } from "@/server/auth";
import {
  buildLibroIvaDailyXlsx,
  buildLibroIvaXlsx,
} from "@/server/excel/build-libro-iva-xlsx";
import {
  buildLibroIvaDailyPdf,
  buildLibroIvaPdf,
} from "@/server/pdf/build-libro-iva-pdf";
import { resolveInvoicePdfIssuer } from "@/server/pdf/invoice-pdf-issuer";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  buildLibroIvaRows,
  libroIvaCustomPeriodLabel,
  libroIvaCustomRange,
  libroIvaDayRange,
  libroIvaMonthRange,
  parseIsoDateValue,
  type LibroIvaDailyReportVariant,
} from "@/features/billing/utils/libro-iva";

type LibroIvaRange = { from: Date; to: Date };

function dailyFilename(
  year: number,
  month: number,
  day: number,
  variant: LibroIvaDailyReportVariant,
  extension: "pdf" | "xlsx",
): string {
  const suffix = variant === "simple" ? "Z-simple" : "Z-detallado";
  return `Libro-IVA-${suffix}-${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.${extension}`;
}

function parseDailyVariant(
  value: string | null | undefined,
): LibroIvaDailyReportVariant {
  return value === "detailed" ? "detailed" : "simple";
}

export class BillingLibroIvaService {
  private async loadRows(range: LibroIvaRange) {
    const [invoices, notes, settings] = await Promise.all([
      billingInvoiceRepository.findIssuedBetween(range.from, range.to),
      billingNoteRepository.findIssuedBetween(range.from, range.to),
      billingFiscalSettingsRepository.getOrCreate(),
    ]);

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
      notes.map((note) => ({
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

  async generatePdf(year: number, month: number): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();

    let range: LibroIvaRange;
    try {
      range = libroIvaMonthRange(year, month);
    } catch {
      throw new BillingInvoiceError("Indicá un mes válido.", "VALIDATION_ERROR");
    }

    const { rows, issuer, environment, ivaPercent, pointOfSale } =
      await this.loadRows(range);
    const bytes = await buildLibroIvaPdf({
      year,
      month,
      rows,
      issuer,
      environment,
      ivaPercent,
      pointOfSale,
    });

    return {
      bytes,
      filename: `Libro-IVA-${year}-${String(month).padStart(2, "0")}.pdf`,
    };
  }

  async generateDailyPdf(
    year: number,
    month: number,
    day: number,
    variantInput?: string | null,
  ): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();
    const variant = parseDailyVariant(variantInput);

    let range: LibroIvaRange;
    try {
      range = libroIvaDayRange(year, month, day);
    } catch {
      throw new BillingInvoiceError("Indicá un día válido.", "VALIDATION_ERROR");
    }

    const { rows, issuer, environment } = await this.loadRows(range);
    const bytes = await buildLibroIvaDailyPdf({
      year,
      month,
      day,
      rows,
      issuer,
      environment,
      variant,
    });

    return {
      bytes,
      filename: dailyFilename(year, month, day, variant, "pdf"),
    };
  }

  async generateXlsx(year: number, month: number): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();

    let range: LibroIvaRange;
    try {
      range = libroIvaMonthRange(year, month);
    } catch {
      throw new BillingInvoiceError("Indicá un mes válido.", "VALIDATION_ERROR");
    }

    const { rows, issuer, ivaPercent, pointOfSale } = await this.loadRows(range);
    const bytes = await buildLibroIvaXlsx({
      year,
      month,
      rows,
      issuer,
      ivaPercent,
      pointOfSale,
    });

    return {
      bytes,
      filename: `Libro-IVA-${year}-${String(month).padStart(2, "0")}.xlsx`,
    };
  }

  async generateDailyXlsx(
    year: number,
    month: number,
    day: number,
    variantInput?: string | null,
  ): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();
    const variant = parseDailyVariant(variantInput);

    let range: LibroIvaRange;
    try {
      range = libroIvaDayRange(year, month, day);
    } catch {
      throw new BillingInvoiceError("Indicá un día válido.", "VALIDATION_ERROR");
    }

    const { rows, issuer } = await this.loadRows(range);
    const bytes = await buildLibroIvaDailyXlsx({
      year,
      month,
      day,
      rows,
      issuer,
      variant,
    });

    return {
      bytes,
      filename: dailyFilename(year, month, day, variant, "xlsx"),
    };
  }

  async generateCustomPdf(
    fromValue: string,
    toValue: string,
  ): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();

    let range: LibroIvaRange;
    let periodText: string;
    try {
      range = libroIvaCustomRange(fromValue, toValue);
      periodText = libroIvaCustomPeriodLabel(fromValue, toValue);
    } catch (caught) {
      throw new BillingInvoiceError(
        caught instanceof Error
          ? caught.message
          : "Indicá un rango de fechas válido.",
        "VALIDATION_ERROR",
      );
    }

    const fromParsed = parseIsoDateValue(fromValue);
    if (!fromParsed) {
      throw new BillingInvoiceError(
        "Indicá un rango de fechas válido.",
        "VALIDATION_ERROR",
      );
    }

    const { rows, issuer, environment, ivaPercent, pointOfSale } =
      await this.loadRows(range);
    const bytes = await buildLibroIvaPdf({
      year: fromParsed.year,
      month: fromParsed.month,
      rows,
      issuer,
      environment,
      ivaPercent,
      pointOfSale,
      periodText,
    });

    return {
      bytes,
      filename: `Libro-IVA-${fromValue}_${toValue}.pdf`,
    };
  }

  async generateCustomXlsx(
    fromValue: string,
    toValue: string,
  ): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requireAdmin();

    let range: LibroIvaRange;
    let periodText: string;
    try {
      range = libroIvaCustomRange(fromValue, toValue);
      periodText = libroIvaCustomPeriodLabel(fromValue, toValue);
    } catch (caught) {
      throw new BillingInvoiceError(
        caught instanceof Error
          ? caught.message
          : "Indicá un rango de fechas válido.",
        "VALIDATION_ERROR",
      );
    }

    const fromParsed = parseIsoDateValue(fromValue);
    if (!fromParsed) {
      throw new BillingInvoiceError(
        "Indicá un rango de fechas válido.",
        "VALIDATION_ERROR",
      );
    }

    const { rows, issuer, ivaPercent, pointOfSale } = await this.loadRows(range);
    const bytes = await buildLibroIvaXlsx({
      year: fromParsed.year,
      month: fromParsed.month,
      rows,
      issuer,
      ivaPercent,
      pointOfSale,
      periodText: periodText.toLocaleUpperCase("es-AR"),
    });

    return {
      bytes,
      filename: `Libro-IVA-${fromValue}_${toValue}.xlsx`,
    };
  }
}

export const billingLibroIvaService = new BillingLibroIvaService();
