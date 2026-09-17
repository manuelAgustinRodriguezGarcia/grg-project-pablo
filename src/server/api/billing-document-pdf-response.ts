import { binaryFileResponse } from "@/server/api/binary-file-response";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import { billingNoteService } from "@/server/services/billing-note.service";
import { billingReceiptService } from "@/server/services/billing-receipt.service";

function wantsDownload(request: Request): boolean {
  return new URL(request.url).searchParams.get("download") === "1";
}

function pdfResponse(
  bytes: Uint8Array,
  filename: string,
  download: boolean,
): Response {
  return binaryFileResponse(
    bytes,
    filename,
    "application/pdf",
    download ? "attachment" : "inline",
  );
}

export async function invoicePdfHttpResponse(
  request: Request,
  invoiceId: string,
): Promise<Response> {
  try {
    const { bytes, filename } =
      await billingInvoiceService.generateInvoicePdf(invoiceId);
    return pdfResponse(bytes, filename, wantsDownload(request));
  } catch (error) {
    console.error("[billingPdf] Factura", invoiceId, error);
    return handleAdminApiError(error);
  }
}

export async function receiptPdfHttpResponse(
  request: Request,
  receiptId: string,
): Promise<Response> {
  try {
    const { bytes, filename } =
      await billingReceiptService.generateReceiptPdf(receiptId);
    return pdfResponse(bytes, filename, wantsDownload(request));
  } catch (error) {
    console.error("[billingPdf] Recibo", receiptId, error);
    return handleAdminApiError(error);
  }
}

export async function notePdfHttpResponse(
  request: Request,
  noteId: string,
): Promise<Response> {
  try {
    const { bytes, filename } =
      await billingNoteService.generateNotePdf(noteId);
    return pdfResponse(bytes, filename, wantsDownload(request));
  } catch (error) {
    console.error("[billingPdf] Nota", noteId, error);
    return handleAdminApiError(error);
  }
}
