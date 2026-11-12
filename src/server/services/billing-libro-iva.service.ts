import { requirePermission } from "@/server/auth";
import {
  buildLibroIvaDailyXlsx,
  buildLibroIvaXlsx,
} from "@/server/excel/build-libro-iva-xlsx";
import {
  buildLibroIvaDailyPdf,
  buildLibroIvaPdf,
} from "@/server/pdf/build-libro-iva-pdf";
import { billingLibroIvaArchiveService } from "@/server/services/billing-libro-iva-archive.service";
import { loadLibroIvaSource } from "@/server/services/billing-libro-iva-source";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  libroIvaCustomPeriodLabel,
  libroIvaCustomRange,
  libroIvaDayRange,
  libroIvaMonthRange,
  libroIvaMonthlyFilename,
  parseIsoDateValue,
  type LibroIvaDailyReportVariant,
  type LibroIvaRow,
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
    return loadLibroIvaSource(range);
  }

  private async retainMonthlyDownload(input: {
    environment: Awaited<ReturnType<typeof loadLibroIvaSource>>["environment"];
    year: number;
    month: number;
    format: "PDF" | "XLSX";
    bytes: Uint8Array;
    filename: string;
    rows: LibroIvaRow[];
    generatedByUserId: string;
  }): Promise<void> {
    try {
      await billingLibroIvaArchiveService.retainMonthlyCopy(input);
    } catch (error) {
      console.error(
        "[billing-libro-iva-archive] La descarga continúa sin archivado.",
        error,
      );
    }
  }

  async generatePdf(year: number, month: number): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    const auth = await requirePermission("invoices.read");

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
    const filename = libroIvaMonthlyFilename(year, month, "pdf");
    await this.retainMonthlyDownload({
      environment,
      year,
      month,
      format: "PDF",
      bytes,
      filename,
      rows,
      generatedByUserId: auth.profile.id,
    });

    return { bytes, filename };
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
    await requirePermission("invoices.read");
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
    const auth = await requirePermission("invoices.read");

    let range: LibroIvaRange;
    try {
      range = libroIvaMonthRange(year, month);
    } catch {
      throw new BillingInvoiceError("Indicá un mes válido.", "VALIDATION_ERROR");
    }

    const { rows, issuer, environment, ivaPercent, pointOfSale } =
      await this.loadRows(range);
    const bytes = await buildLibroIvaXlsx({
      year,
      month,
      rows,
      issuer,
      ivaPercent,
      pointOfSale,
    });
    const filename = libroIvaMonthlyFilename(year, month, "xlsx");
    await this.retainMonthlyDownload({
      environment,
      year,
      month,
      format: "XLSX",
      bytes,
      filename,
      rows,
      generatedByUserId: auth.profile.id,
    });

    return { bytes, filename };
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
    await requirePermission("invoices.read");
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
    await requirePermission("invoices.read");

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
    await requirePermission("invoices.read");

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
