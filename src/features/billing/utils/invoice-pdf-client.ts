function invoicePdfUrl(invoiceId: string): string {
  return `/api/admin/billing/invoices/${invoiceId}`;
}

function receiptPdfUrl(receiptId: string): string {
  return `/api/admin/billing/receipts/${receiptId}`;
}

function notePdfUrl(noteId: string): string {
  return `/api/admin/billing/notes/${noteId}`;
}

async function fetchPdfBlob(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include" });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para generar el PDF. Recargá la página e intentá de nuevo.",
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `No se pudo generar el PDF (${response.status}).`,
    );
  }

  return response.blob();
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function printPdfFromUrl(url: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.addEventListener("load", () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => {
      frame.remove();
    }, 60_000);
  });
  document.body.append(frame);
}

async function printPdfAtUrl(url: string): Promise<void> {
  await fetchPdfBlob(url);
  printPdfFromUrl(url);
}

function blobToPdfFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: blob.type || "application/pdf",
  });
}

function canSharePdfFile(file: File): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }

  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function isShareAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export type SharePdfResult = "shared" | "saved" | "cancelled";

export async function sharePdfFile(
  file: File,
  title: string,
  text: string,
): Promise<SharePdfResult> {
  if (canSharePdfFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      return "shared";
    } catch (error) {
      if (isShareAbort(error)) {
        return "cancelled";
      }
    }
  }

  triggerDownload(file, file.name);
  return "saved";
}

export async function getInvoicePdfFile(
  invoiceId: string,
  filename: string,
): Promise<File> {
  const blob = await fetchPdfBlob(invoicePdfUrl(invoiceId));
  return blobToPdfFile(blob, filename);
}

export async function getReceiptPdfFile(
  receiptId: string,
  filename: string,
): Promise<File> {
  const blob = await fetchPdfBlob(receiptPdfUrl(receiptId));
  return blobToPdfFile(blob, filename);
}

export async function getNotePdfFile(
  noteId: string,
  filename: string,
): Promise<File> {
  const blob = await fetchPdfBlob(notePdfUrl(noteId));
  return blobToPdfFile(blob, filename);
}

export async function downloadInvoicePdf(
  invoiceId: string,
  filename: string,
): Promise<void> {
  const blob = await fetchPdfBlob(invoicePdfUrl(invoiceId));
  triggerDownload(blob, filename);
}

export async function printInvoicePdf(invoiceId: string): Promise<void> {
  await printPdfAtUrl(invoicePdfUrl(invoiceId));
}

export async function downloadReceiptPdf(
  receiptId: string,
  filename: string,
): Promise<void> {
  const blob = await fetchPdfBlob(receiptPdfUrl(receiptId));
  triggerDownload(blob, filename);
}

export async function printReceiptPdf(receiptId: string): Promise<void> {
  await printPdfAtUrl(receiptPdfUrl(receiptId));
}

export async function downloadNotePdf(
  noteId: string,
  filename: string,
): Promise<void> {
  const blob = await fetchPdfBlob(notePdfUrl(noteId));
  triggerDownload(blob, filename);
}

export async function printNotePdf(noteId: string): Promise<void> {
  await printPdfAtUrl(notePdfUrl(noteId));
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `Factura-${invoiceNumber}.pdf`;
}

export function receiptPdfFilename(receiptNumber: string): string {
  return `Recibo-${receiptNumber}.pdf`;
}

export function notePdfFilename(
  kind: "CREDIT" | "DEBIT",
  noteNumber: string,
): string {
  const prefix = kind === "CREDIT" ? "Nota-credito" : "Nota-debito";
  return `${prefix}-${noteNumber}.pdf`;
}

function libroIvaPdfUrl(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): string {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (day !== undefined) {
    params.set("day", String(day));
    params.set("variant", variant ?? "simple");
  }
  return `/api/admin/billing/libro-iva/pdf?${params.toString()}`;
}

function libroIvaXlsxUrl(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): string {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (day !== undefined) {
    params.set("day", String(day));
    params.set("variant", variant ?? "simple");
  }
  return `/api/admin/billing/libro-iva/xlsx?${params.toString()}`;
}

function libroIvaCustomPdfUrl(from: string, to: string): string {
  const params = new URLSearchParams({
    period: "custom",
    from,
    to,
  });
  return `/api/admin/billing/libro-iva/pdf?${params.toString()}`;
}

function libroIvaCustomXlsxUrl(from: string, to: string): string {
  const params = new URLSearchParams({
    period: "custom",
    from,
    to,
  });
  return `/api/admin/billing/libro-iva/xlsx?${params.toString()}`;
}

export function libroIvaPdfFilename(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): string {
  const monthPart = String(month).padStart(2, "0");
  if (day === undefined) {
    return `Libro-IVA-${year}-${monthPart}.pdf`;
  }
  const suffix = variant === "detailed" ? "Z-detallado" : "Z-simple";
  return `Libro-IVA-${suffix}-${year}-${monthPart}-${String(day).padStart(2, "0")}.pdf`;
}

export function libroIvaXlsxFilename(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): string {
  const monthPart = String(month).padStart(2, "0");
  if (day === undefined) {
    return `Libro-IVA-${year}-${monthPart}.xlsx`;
  }
  const suffix = variant === "detailed" ? "Z-detallado" : "Z-simple";
  return `Libro-IVA-${suffix}-${year}-${monthPart}-${String(day).padStart(2, "0")}.xlsx`;
}

export function libroIvaCustomFilename(
  from: string,
  to: string,
  extension: "pdf" | "xlsx",
): string {
  return `Libro-IVA-${from}_${to}.${extension}`;
}

export async function downloadLibroIvaPdf(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): Promise<void> {
  const blob = await fetchPdfBlob(libroIvaPdfUrl(year, month, day, variant));
  triggerDownload(blob, libroIvaPdfFilename(year, month, day, variant));
}

export async function printLibroIvaPdf(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): Promise<void> {
  await printPdfAtUrl(libroIvaPdfUrl(year, month, day, variant));
}

export async function downloadLibroIvaXlsx(
  year: number,
  month: number,
  day?: number,
  variant?: "simple" | "detailed",
): Promise<void> {
  const blob = await fetchPdfBlob(libroIvaXlsxUrl(year, month, day, variant));
  triggerDownload(blob, libroIvaXlsxFilename(year, month, day, variant));
}

export async function downloadLibroIvaCustomPdf(
  from: string,
  to: string,
): Promise<void> {
  const blob = await fetchPdfBlob(libroIvaCustomPdfUrl(from, to));
  triggerDownload(blob, libroIvaCustomFilename(from, to, "pdf"));
}

export async function printLibroIvaCustomPdf(
  from: string,
  to: string,
): Promise<void> {
  await printPdfAtUrl(libroIvaCustomPdfUrl(from, to));
}

export async function downloadLibroIvaCustomXlsx(
  from: string,
  to: string,
): Promise<void> {
  const blob = await fetchPdfBlob(libroIvaCustomXlsxUrl(from, to));
  triggerDownload(blob, libroIvaCustomFilename(from, to, "xlsx"));
}
