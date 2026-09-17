import { binaryFileResponse } from "@/server/api/binary-file-response";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { billingLibroIvaService } from "@/server/services/billing-libro-iva.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    const download = url.searchParams.get("download") === "1";

    if (period === "custom") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!from || !to) {
        throw new BillingInvoiceError(
          "Indicá un rango de fechas válido.",
          "VALIDATION_ERROR",
        );
      }

      const payload = await billingLibroIvaService.generateCustomPdf(from, to);
      return binaryFileResponse(
        payload.bytes,
        payload.filename,
        "application/pdf",
        download ? "attachment" : "inline",
      );
    }

    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    const dayParam = url.searchParams.get("day");
    const day = dayParam === null || dayParam === "" ? null : Number(dayParam);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      throw new BillingInvoiceError("Indicá un mes válido.", "VALIDATION_ERROR");
    }

    const payload =
      day === null
        ? await billingLibroIvaService.generatePdf(year, month)
        : await billingLibroIvaService.generateDailyPdf(
            year,
            month,
            day,
            url.searchParams.get("variant"),
          );

    return binaryFileResponse(
      payload.bytes,
      payload.filename,
      "application/pdf",
      download ? "attachment" : "inline",
    );
  } catch (error) {
    return handleAdminApiError(error);
  }
}
