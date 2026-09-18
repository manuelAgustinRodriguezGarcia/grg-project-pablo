import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { RECEIPT_PAYMENT_METHOD_LABELS } from "@/features/billing/types/billing-receipt.types";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  drawBillingDocumentHeader,
  embedBillingPdfLogo,
} from "@/server/pdf/billing-pdf-header";
import {
  issuerFiscalLines,
  issuerIdentityLines,
} from "@/server/pdf/invoice-pdf-issuer";
import type { ReceiptPdfInput } from "@/server/pdf/invoice-pdf.types";
import {
  A4_HEIGHT,
  A4_WIDTH,
  PAGE_MARGIN,
  PDF_AMBER,
  PDF_AMBER_BG,
  PDF_BLUE,
  PDF_GRAY,
  PDF_MUTED,
  PDF_NAVY,
  drawPdfText,
  formatPdfDate,
  wrapPdfText,
} from "@/server/pdf/pdf-layout";

const TEST_BANNER = "MODO PRUEBA - NO VALIDO COMO FACTURA FISCAL";
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

export async function buildReceiptPdf(
  input: ReceiptPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const testMode = input.environment === "MODO_PRUEBA";

  if (testMode) {
    page.drawText(toWinAnsi(TEST_BANNER), {
      x: 90,
      y: A4_HEIGHT / 2,
      size: 16,
      font: bold,
      color: rgb(0.75, 0.55, 0.2),
      opacity: 0.14,
      rotate: degrees(28),
    });
  }

  let y = A4_HEIGHT - PAGE_MARGIN;

  if (testMode) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 22,
      width: CONTENT_WIDTH,
      height: 22,
      color: PDF_AMBER_BG,
    });
    drawPdfText(page, TEST_BANNER, {
      x: PAGE_MARGIN + 8,
      y: y - 16,
      size: 8,
      font: bold,
      color: PDF_AMBER,
    });
    y -= 36;
  }

  const logo = await embedBillingPdfLogo(pdf, input.logoPng);
  y = drawBillingDocumentHeader(page, font, bold, {
    startY: y,
    box: { kind: "RECIBO" },
    logo,
    title: "RECIBO DE PAGO",
    titleColor: PDF_NAVY,
    documentNumber: input.receiptNumber,
    metaLines: [`Fecha: ${formatPdfDate(input.issuedAt)}`],
    fiscalLines: issuerFiscalLines(input.issuer),
    identityLines: issuerIdentityLines(input.issuer),
  });

  y -= 16;
  const clientBoxHeight = 72;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - clientBoxHeight,
    width: CONTENT_WIDTH,
    height: clientBoxHeight,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Recibimos de", {
    x: PAGE_MARGIN + 10,
    y: y - 14,
    size: 8,
    font: bold,
    color: PDF_BLUE,
  });
  drawPdfText(page, input.clientName, {
    x: PAGE_MARGIN + 10,
    y: y - 30,
    size: 11,
    font: bold,
  });

  const identification = formatInvoiceIdentification(
    input.clientIdentificationType,
    input.clientIdentificationNumber,
  );
  if (identification) {
    drawPdfText(page, identification, {
      x: PAGE_MARGIN + 10,
      y: y - 44,
      size: 8,
      font,
    });
  }

  const methodLabel = RECEIPT_PAYMENT_METHOD_LABELS[input.paymentMethod];
  drawPdfText(page, `Metodo: ${methodLabel}`, {
    x: PAGE_MARGIN + 10,
    y: y - 58,
    size: 8,
    font,
  });

  y -= clientBoxHeight + 18;

  if (input.allocations.length === 0) {
    drawPdfText(page, "Pago a cuenta", {
      x: PAGE_MARGIN,
      y,
      size: 9,
      font: bold,
    });
    y -= 16;
  } else {
    const colInvoice = PAGE_MARGIN;
    const colMethod = PAGE_MARGIN + CONTENT_WIDTH * 0.42;
    const colAmount = PAGE_MARGIN + CONTENT_WIDTH * 0.72;
    const rowHeight = 14;

    drawPdfText(page, "N° factura", {
      x: colInvoice,
      y,
      size: 8,
      font: bold,
    });
    drawPdfText(page, "Metodo de pago", {
      x: colMethod,
      y,
      size: 8,
      font: bold,
    });
    drawPdfText(page, "Monto", {
      x: colAmount,
      y,
      size: 8,
      font: bold,
    });
    y -= 4;
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 1,
      width: CONTENT_WIDTH,
      height: 1,
      color: PDF_GRAY,
    });
    y -= rowHeight;

    for (const allocation of input.allocations) {
      const invoiceLabel = `${allocation.invoiceType} ${allocation.invoiceNumber}`;
      drawPdfText(page, invoiceLabel, {
        x: colInvoice,
        y,
        size: 8,
        font,
        maxWidth: colMethod - colInvoice - 8,
      });
      drawPdfText(page, methodLabel, {
        x: colMethod,
        y,
        size: 8,
        font,
        maxWidth: colAmount - colMethod - 8,
      });
      drawPdfText(page, `$ ${formatPdfAmount(allocation.amount)}`, {
        x: colAmount,
        y,
        size: 8,
        font,
      });
      y -= rowHeight;
    }
  }

  y -= 10;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 18,
    width: CONTENT_WIDTH,
    height: 36,
    color: PDF_NAVY,
  });
  drawPdfText(page, "Importe recibido", {
    x: PAGE_MARGIN + 12,
    y: y,
    size: 10,
    font,
    color: rgb(1, 1, 1),
  });
  const amount = `$ ${formatPdfAmount(input.amount)}`;
  const amountWidth = bold.widthOfTextAtSize(toWinAnsi(amount), 14);
  drawPdfText(page, amount, {
    x: A4_WIDTH - PAGE_MARGIN - 12 - amountWidth,
    y: y - 2,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y -= 48;
  const extraLines = [
    `Emitido por: ${input.createdByName}`,
    input.remainingAmount > 0
      ? `A cuenta: $ ${formatPdfAmount(input.remainingAmount)}`
      : null,
    "Recibo interno del sistema. No es un comprobante fiscal.",
  ].filter((line): line is string => Boolean(line));
  for (const line of extraLines) {
    drawPdfText(page, line, {
      x: PAGE_MARGIN,
      y,
      size: 8,
      font,
      color: PDF_GRAY,
    });
    y -= 12;
  }

  if (input.notes?.trim()) {
    y -= 8;
    drawPdfText(page, "Observaciones", {
      x: PAGE_MARGIN,
      y,
      size: 8,
      font: bold,
    });
    y -= 12;
    for (const line of wrapPdfText(input.notes.trim(), font, 8, CONTENT_WIDTH)) {
      drawPdfText(page, line, {
        x: PAGE_MARGIN,
        y,
        size: 8,
        font,
      });
      y -= 11;
    }
  }

  return pdf.save();
}
