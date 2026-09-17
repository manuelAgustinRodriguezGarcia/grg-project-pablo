import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { NOTE_KIND_LABELS } from "@/features/billing/types/billing-note.types";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  drawBillingDocumentHeader,
  embedBillingPdfLogo,
} from "@/server/pdf/billing-pdf-header";
import {
  comprobanteLetterColor,
  type PdfComprobanteBox,
} from "@/server/pdf/comprobante-letter-box";
import {
  issuerFiscalLines,
  issuerIdentityLines,
} from "@/server/pdf/invoice-pdf-issuer";
import type { InvoicePdfIssuer } from "@/server/pdf/invoice-pdf.types";
import {
  A4_HEIGHT,
  A4_WIDTH,
  PAGE_MARGIN,
  PDF_AMBER,
  PDF_AMBER_BG,
  PDF_BLUE,
  PDF_GRAY,
  PDF_MUTED,
  drawPdfText,
  formatPdfDate,
  wrapPdfText,
} from "@/server/pdf/pdf-layout";

const TEST_BANNER = "MODO PRUEBA - NO VALIDO COMO COMPROBANTE FISCAL";
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

export type NotePdfInput = {
  kind: BillingNoteKind;
  noteNumber: string;
  invoiceType: BillingInvoiceType;
  invoiceNumber: string;
  issuedAt: Date;
  amount: number;
  netAmount: number;
  ivaAmount: number;
  ivaPercent: number;
  reason: string;
  clientName: string;
  clientCode: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  createdByName: string;
  issuer: InvoicePdfIssuer;
  logoPng: Uint8Array | null;
  environment: BillingFiscalEnvironment;
};

function noteComprobanteBox(
  kind: BillingNoteKind,
  letter: BillingInvoiceType,
): PdfComprobanteBox {
  switch (kind) {
    case "CREDIT":
      return { kind: "NOTA_CREDITO", letter };
    case "DEBIT":
      return { kind: "NOTA_DEBITO", letter };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export async function buildNotePdf(input: NotePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const testMode = input.environment === "MODO_PRUEBA";
  const title = NOTE_KIND_LABELS[input.kind].toUpperCase();

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
    box: noteComprobanteBox(input.kind, input.invoiceType),
    logo,
    title,
    titleColor: comprobanteLetterColor(input.invoiceType),
    documentNumber: input.noteNumber,
    metaLines: [`Fecha: ${formatPdfDate(input.issuedAt)}`],
    fiscalLines: issuerFiscalLines(input.issuer),
    identityLines: issuerIdentityLines(input.issuer),
  });

  y -= 10;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - 72,
    width: CONTENT_WIDTH,
    height: 84,
    color: PDF_MUTED,
  });
  drawPdfText(page, "Cliente", {
    x: PAGE_MARGIN + 10,
    y: y - 8,
    size: 8,
    font: bold,
    color: PDF_BLUE,
  });
  drawPdfText(page, input.clientName, {
    x: PAGE_MARGIN + 10,
    y: y - 24,
    size: 11,
    font: bold,
  });
  drawPdfText(page, input.clientCode, {
    x: PAGE_MARGIN + 10,
    y: y - 38,
    size: 8,
    font,
  });
  const identification = formatInvoiceIdentification(
    input.clientIdentificationType,
    input.clientIdentificationNumber,
  );
  if (identification) {
    drawPdfText(page, identification, {
      x: PAGE_MARGIN + 10,
      y: y - 52,
      size: 8,
      font,
    });
  }
  drawPdfText(
    page,
    `Factura ${input.invoiceType} ${input.invoiceNumber}`,
    {
      x: PAGE_MARGIN + 10,
      y: y - 66,
      size: 8,
      font: bold,
    },
  );

  y -= 108;
  drawPdfText(page, `Importe: $${formatPdfAmount(input.amount)}`, {
    x: PAGE_MARGIN,
    y,
    size: 12,
    font: bold,
  });
  y -= 16;
  drawPdfText(
    page,
    `Neto $${formatPdfAmount(input.netAmount)}  ·  IVA ${input.ivaPercent}% $${formatPdfAmount(input.ivaAmount)}`,
    {
      x: PAGE_MARGIN,
      y,
      size: 8,
      font,
      color: PDF_GRAY,
    },
  );
  y -= 22;
  drawPdfText(page, "Motivo", {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font: bold,
    color: PDF_BLUE,
  });
  y -= 14;
  const reasonLines = wrapPdfText(input.reason, font, 10, CONTENT_WIDTH);
  for (const line of reasonLines) {
    drawPdfText(page, line, {
      x: PAGE_MARGIN,
      y,
      size: 10,
      font,
    });
    y -= 13;
  }

  y -= 16;
  drawPdfText(page, `Emitida por ${input.createdByName}`, {
    x: PAGE_MARGIN,
    y,
    size: 8,
    font,
    color: PDF_GRAY,
  });

  return pdf.save();
}
