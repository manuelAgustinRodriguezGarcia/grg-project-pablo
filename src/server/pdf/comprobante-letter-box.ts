import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { toWinAnsi } from "@/features/billing/utils/win-ansi";
import {
  A4_WIDTH,
  PAGE_MARGIN,
  PDF_BLUE,
  PDF_NAVY,
  PDF_ORANGE,
  drawPdfText,
} from "@/server/pdf/pdf-layout";

/** Códigos de comprobante AFIP/ARCA (WSFEv1). Recibo X es interno. */
export type PdfComprobanteBox =
  | { kind: "FACTURA"; letter: "A" | "B" }
  | { kind: "NOTA_CREDITO"; letter: "A" | "B" }
  | { kind: "NOTA_DEBITO"; letter: "A" | "B" }
  | { kind: "RECIBO" };

export const COMPROBANTE_LETTER_BOX_WIDTH = 76;
export const COMPROBANTE_LETTER_BOX_HEIGHT = 64;
const LETTER_GAP = 28;

export type ComprobanteLetterBoxLayout = {
  boxX: number;
  boxY: number;
  width: number;
  height: number;
  leftMaxWidth: number;
  rightX: number;
  rightMaxWidth: number;
};

export function pdfComprobanteLetter(
  box: PdfComprobanteBox,
): "A" | "B" | "X" {
  switch (box.kind) {
    case "FACTURA":
    case "NOTA_CREDITO":
    case "NOTA_DEBITO":
      return box.letter;
    case "RECIBO":
      return "X";
    default: {
      const exhaustive: never = box;
      return exhaustive;
    }
  }
}

export function pdfComprobanteCodeLabel(box: PdfComprobanteBox): string {
  switch (box.kind) {
    case "FACTURA":
      switch (box.letter) {
        case "A":
          return "COD. 001";
        case "B":
          return "COD. 006";
        default: {
          const exhaustive: never = box.letter;
          return exhaustive;
        }
      }
    case "NOTA_DEBITO":
      switch (box.letter) {
        case "A":
          return "COD. 002";
        case "B":
          return "COD. 007";
        default: {
          const exhaustive: never = box.letter;
          return exhaustive;
        }
      }
    case "NOTA_CREDITO":
      switch (box.letter) {
        case "A":
          return "COD. 003";
        case "B":
          return "COD. 008";
        default: {
          const exhaustive: never = box.letter;
          return exhaustive;
        }
      }
    case "RECIBO":
      return "RECIBO X";
    default: {
      const exhaustive: never = box;
      return exhaustive;
    }
  }
}

export function comprobanteLetterColor(letter: "A" | "B" | "X"): RGB {
  switch (letter) {
    case "A":
      return PDF_ORANGE;
    case "B":
      return PDF_BLUE;
    case "X":
      return PDF_NAVY;
    default: {
      const exhaustive: never = letter;
      return exhaustive;
    }
  }
}

export function comprobanteLetterBoxX(): number {
  return (A4_WIDTH - COMPROBANTE_LETTER_BOX_WIDTH) / 2;
}

function centeredX(
  text: string,
  font: PDFFont,
  size: number,
  boxX: number,
): number {
  const width = font.widthOfTextAtSize(toWinAnsi(text), size);
  return boxX + (COMPROBANTE_LETTER_BOX_WIDTH - width) / 2;
}

/**
 * Box de letra centrado en el encabezado, con código de comprobante debajo.
 * Formato habitual argentino: A/B/X arriba, COD. xxx (o RECIBO X) abajo.
 */
export function drawComprobanteLetterBox(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  box: PdfComprobanteBox,
  topY: number,
): ComprobanteLetterBoxLayout {
  const letter = pdfComprobanteLetter(box);
  const code = pdfComprobanteCodeLabel(box);
  const color = comprobanteLetterColor(letter);
  const boxX = comprobanteLetterBoxX();
  const boxY = topY - COMPROBANTE_LETTER_BOX_HEIGHT;
  const letterSize = 26;
  const codeSize = 7;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: COMPROBANTE_LETTER_BOX_WIDTH,
    height: COMPROBANTE_LETTER_BOX_HEIGHT,
    borderColor: color,
    borderWidth: 1.6,
  });

  drawPdfText(page, letter, {
    x: centeredX(letter, bold, letterSize, boxX),
    y: boxY + 28,
    size: letterSize,
    font: bold,
    color,
  });
  drawPdfText(page, code, {
    x: centeredX(code, font, codeSize, boxX),
    y: boxY + 10,
    size: codeSize,
    font,
    color,
  });

  const rightX = boxX + COMPROBANTE_LETTER_BOX_WIDTH + LETTER_GAP;

  return {
    boxX,
    boxY,
    width: COMPROBANTE_LETTER_BOX_WIDTH,
    height: COMPROBANTE_LETTER_BOX_HEIGHT,
    leftMaxWidth: boxX - PAGE_MARGIN - 10,
    rightX,
    rightMaxWidth: A4_WIDTH - PAGE_MARGIN - rightX,
  };
}
