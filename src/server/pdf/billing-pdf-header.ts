import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import {
  drawComprobanteLetterBox,
  type PdfComprobanteBox,
} from "@/server/pdf/comprobante-letter-box";
import {
  PAGE_MARGIN,
  PDF_GRAY,
  PDF_NAVY,
  drawPdfText,
} from "@/server/pdf/pdf-layout";

export const PDF_HEADER_LOGO_MAX_WIDTH = 140;
export const PDF_HEADER_LOGO_TOP_NUDGE = 8;
export const PDF_HEADER_IDENTITY_SIZE = 8;
export const PDF_HEADER_IDENTITY_LINE_GAP = 11;

export async function embedBillingPdfLogo(
  pdf: PDFDocument,
  logoPng: Uint8Array | null,
): Promise<PDFImage | null> {
  if (!logoPng) {
    return null;
  }

  try {
    return await pdf.embedPng(logoPng);
  } catch (error) {
    console.error("[billingPdf] No se pudo incrustar el logo:", error);
    return null;
  }
}

/**
 * Última línea del domicilio alineada con la última línea fiscal.
 * El logo SVG ya trae padding; no se usa el bounding box de la imagen
 * para no empujar el bloque más abajo de la columna derecha.
 */
export function identityFirstLineY(params: {
  lastRightLineY: number;
  lineCount: number;
}): number {
  if (params.lineCount <= 0) {
    return params.lastRightLineY;
  }

  return (
    params.lastRightLineY +
    (params.lineCount - 1) * PDF_HEADER_IDENTITY_LINE_GAP
  );
}

export type BillingPdfHeaderInput = {
  startY: number;
  box: PdfComprobanteBox;
  logo: PDFImage | null;
  title: string;
  titleColor: RGB;
  documentNumber: string;
  metaLines: readonly string[];
  dateLine?: string;
  fiscalLines: readonly string[];
  identityLines: readonly string[];
};

export function drawBillingDocumentHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: BillingPdfHeaderInput,
): number {
  const letterBox = drawComprobanteLetterBox(
    page,
    font,
    bold,
    input.box,
    input.startY,
  );

  if (input.logo && input.logo.width > 0 && input.logo.height > 0) {
    const width = Math.min(PDF_HEADER_LOGO_MAX_WIDTH, letterBox.leftMaxWidth);
    const scale = width / input.logo.width;
    const height = input.logo.height * scale;
    const logoY = input.startY - height + PDF_HEADER_LOGO_TOP_NUDGE;
    page.drawImage(input.logo, {
      x: PAGE_MARGIN,
      y: logoY,
      width,
      height,
    });
  }

  drawPdfText(page, input.title, {
    x: letterBox.rightX,
    y: input.startY,
    size: 11,
    font: bold,
    color: input.titleColor,
    maxWidth: letterBox.rightMaxWidth,
  });
  drawPdfText(page, input.documentNumber, {
    x: letterBox.rightX,
    y: input.startY - 16,
    size: 9,
    font: bold,
    color: PDF_NAVY,
    maxWidth: letterBox.rightMaxWidth,
  });

  let rightY = input.startY - 30;
  let lastRightLineY = input.startY - 16;

  if (input.dateLine) {
    rightY = input.startY - 28;
    drawPdfText(page, input.dateLine, {
      x: letterBox.rightX,
      y: rightY,
      size: 9,
      font: bold,
      color: PDF_NAVY,
      maxWidth: letterBox.rightMaxWidth,
    });
    lastRightLineY = rightY;
    rightY -= 12;
  }

  for (const line of input.metaLines) {
    drawPdfText(page, line, {
      x: letterBox.rightX,
      y: rightY,
      size: 8,
      font,
      color: PDF_GRAY,
      maxWidth: letterBox.rightMaxWidth,
    });
    lastRightLineY = rightY;
    rightY -= 12;
  }

  rightY -= 2;
  for (const line of input.fiscalLines) {
    drawPdfText(page, line, {
      x: letterBox.rightX,
      y: rightY,
      size: 7,
      font,
      color: PDF_GRAY,
      maxWidth: letterBox.rightMaxWidth,
    });
    lastRightLineY = rightY;
    rightY -= 10;
  }

  let lastIdentityY = lastRightLineY;
  if (input.identityLines.length > 0) {
    let identityY = identityFirstLineY({
      lastRightLineY,
      lineCount: input.identityLines.length,
    });

    for (const line of input.identityLines) {
      drawPdfText(page, line, {
        x: PAGE_MARGIN,
        y: identityY,
        size: PDF_HEADER_IDENTITY_SIZE,
        font,
        color: PDF_GRAY,
        maxWidth: letterBox.leftMaxWidth,
      });
      lastIdentityY = identityY;
      identityY -= PDF_HEADER_IDENTITY_LINE_GAP;
    }
  }

  return Math.min(letterBox.boxY, lastIdentityY, lastRightLineY);
}
