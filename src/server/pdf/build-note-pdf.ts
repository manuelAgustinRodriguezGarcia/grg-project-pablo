import type { PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteFiscalStatus,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import { NOTE_KIND_LABELS } from "@/features/billing/types/billing-note.types";
import { formatPdfAmount } from "@/features/billing/utils/pdf-money";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import { buildArcaNoteQrUrl } from "@/server/arca/qr/build-arca-qr";
import { renderArcaQrPng } from "@/server/arca/qr/render-arca-qr-png";
import { voucherTypeForBillingNote } from "@/shared/fiscal/arca-fiscal-mapping";
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
  PDF_NAVY,
  drawPdfText,
  formatPdfDate,
  wrapPdfText,
} from "@/server/pdf/pdf-layout";

const TEST_BANNER = "MODO PRUEBA - NO VALIDO COMO COMPROBANTE FISCAL";
const HOMOLOGATION_BANNER = "HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN";
const QR_DRAW_SIZE = 108;
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
  issuer: InvoicePdfIssuer;
  logoPng: Uint8Array | null;
  environment: BillingFiscalEnvironment;
  fiscalStatus?: BillingNoteFiscalStatus;
  clientIvaCondition?: BillingIvaCondition;
  pointOfSale?: string;
  sequenceNumber?: number | null;
  voucherType?: number | null;
  cae?: string | null;
  caeExpiresAt?: Date | null;
  associatedIssuedAt?: Date | null;
};

type NotePdfPresentation = "internal" | "homologation" | "production";

function notePdfPresentation(input: NotePdfInput): NotePdfPresentation {
  if ((input.fiscalStatus ?? "INTERNA") === "INTERNA") {
    return "internal";
  }

  switch (input.environment) {
    case "HOMOLOGACION":
      return "homologation";
    case "PRODUCCION":
      return "production";
    case "MODO_PRUEBA":
      throw new ArcaQrError("Una nota autorizada no puede estar en modo prueba.");
    default: {
      const unexpected: never = input.environment;
      return unexpected;
    }
  }
}

function assertAuthorizedNote(input: NotePdfInput): void {
  const voucherType = voucherTypeForBillingNote(input.kind, input.invoiceType);

  if (input.voucherType !== voucherType) {
    throw new ArcaQrError("El tipo de comprobante de la nota no es válido.");
  }

  if (!input.cae?.trim()) {
    throw new ArcaQrError("El CAE del comprobante no está disponible.");
  }

  if (!input.caeExpiresAt || Number.isNaN(input.caeExpiresAt.getTime())) {
    throw new ArcaQrError("El vencimiento del CAE no está disponible.");
  }

  if (!input.pointOfSale?.trim()) {
    throw new ArcaQrError("El punto de venta del comprobante no es válido.");
  }

  if (
    input.sequenceNumber == null ||
    !Number.isSafeInteger(input.sequenceNumber) ||
    input.sequenceNumber < 1
  ) {
    throw new ArcaQrError("El número de comprobante no es válido.");
  }

  if (!input.noteNumber.trim() || input.noteNumber.includes("PRUEBA")) {
    throw new ArcaQrError("El número fiscal de la nota no es válido.");
  }

  if (!input.clientIvaCondition) {
    throw new ArcaQrError("La condición de IVA del receptor no está disponible.");
  }
}

function formatCaeExpiration(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

async function drawFiscalFooter(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: NotePdfInput,
): Promise<void> {
  const url = buildArcaNoteQrUrl({
    fiscalStatus: "AUTORIZADA",
    environment: input.environment,
    kind: input.kind,
    invoiceType: input.invoiceType,
    voucherType: input.voucherType ?? null,
    cae: input.cae ?? null,
    pointOfSale: input.pointOfSale ?? "",
    sequenceNumber: input.sequenceNumber ?? null,
    amount: input.amount,
    issuedAt: input.issuedAt,
    issuerCuit: input.issuer.cuit,
    clientIdentificationType: input.clientIdentificationType,
    clientIdentificationNumber: input.clientIdentificationNumber,
  });
  const image = await pdf.embedPng(await renderArcaQrPng(url));
  const qrY = PAGE_MARGIN;
  const rightEdge = A4_WIDTH - PAGE_MARGIN;
  const caeLine = `CAE: ${input.cae ?? ""}`;
  const expiryLine = `Vto. CAE: ${formatCaeExpiration(input.caeExpiresAt!)}`;

  page.drawImage(image, {
    x: PAGE_MARGIN,
    y: qrY,
    width: QR_DRAW_SIZE,
    height: QR_DRAW_SIZE,
  });
  drawPdfText(page, caeLine, {
    x: rightEdge - bold.widthOfTextAtSize(toWinAnsi(caeLine), 10),
    y: qrY + 13,
    size: 10,
    font: bold,
    color: PDF_NAVY,
  });
  drawPdfText(page, expiryLine, {
    x: rightEdge - font.widthOfTextAtSize(toWinAnsi(expiryLine), 9),
    y: qrY,
    size: 9,
    font,
    color: PDF_NAVY,
  });
}

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
  const presentation = notePdfPresentation(input);
  if (presentation !== "internal") {
    assertAuthorizedNote(input);
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const testMode = presentation === "internal" && input.environment === "MODO_PRUEBA";
  const homologation = presentation === "homologation";
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

  if (homologation) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - 22,
      width: CONTENT_WIDTH,
      height: 22,
      color: PDF_MUTED,
      borderColor: PDF_BLUE,
      borderWidth: 0.6,
    });
    drawPdfText(page, HOMOLOGATION_BANNER, {
      x: PAGE_MARGIN + 8,
      y: y - 16,
      size: 8,
      font: bold,
      color: PDF_BLUE,
    });
    y -= 36;
  }

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
    fiscalLines: issuerFiscalLines(input.issuer, presentation === "internal"),
    identityLines: issuerIdentityLines(input.issuer, presentation === "internal"),
  });

  if (presentation !== "internal" && input.issuer.ivaCondition?.trim()) {
    y -= 8;
    drawPdfText(page, `Condición frente al IVA: ${input.issuer.ivaCondition.trim()}`, {
      x: PAGE_MARGIN,
      y,
      size: 8,
      font,
      color: PDF_GRAY,
    });
    y -= 4;
  }

  y -= 10;
  const fiscalClient = presentation !== "internal";
  const clientBoxHeight = fiscalClient ? 112 : 84;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - (clientBoxHeight - 12),
    width: CONTENT_WIDTH,
    height: clientBoxHeight,
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
  if (fiscalClient && input.clientIvaCondition) {
    drawPdfText(page, `Condición IVA: ${IVA_CONDITION_LABELS[input.clientIvaCondition]}`, {
      x: PAGE_MARGIN + 10,
      y: y - 66,
      size: 8,
      font,
    });
    drawPdfText(page, "Comprobante asociado", {
      x: PAGE_MARGIN + 10,
      y: y - 80,
      size: 8,
      font: bold,
      color: PDF_BLUE,
    });
    const associatedDate = input.associatedIssuedAt
      ? `  Fecha: ${formatPdfDate(input.associatedIssuedAt)}`
      : "";
    drawPdfText(
      page,
      `Factura ${input.invoiceType} ${input.invoiceNumber}${associatedDate}`,
      {
        x: PAGE_MARGIN + 10,
        y: y - 94,
        size: 8,
        font: bold,
      },
    );
  } else {
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
  }

  y -= fiscalClient ? 136 : 108;
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

  if (presentation !== "internal") {
    await drawFiscalFooter(pdf, page, font, bold, input);
  }

  return pdf.save();
}
