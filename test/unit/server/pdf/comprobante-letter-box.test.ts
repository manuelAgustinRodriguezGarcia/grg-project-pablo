import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  COMPROBANTE_LETTER_BOX_HEIGHT,
  COMPROBANTE_LETTER_BOX_WIDTH,
  comprobanteLetterBoxX,
  drawComprobanteLetterBox,
  pdfComprobanteCodeLabel,
  pdfComprobanteLetter,
  type PdfComprobanteBox,
} from "@/server/pdf/comprobante-letter-box";
import { A4_HEIGHT, A4_WIDTH } from "@/server/pdf/pdf-layout";

describe("pdfComprobanteLetter", () => {
  it("usa A/B según el comprobante y X en Recibo", () => {
    expect(pdfComprobanteLetter({ kind: "FACTURA", letter: "A" })).toBe("A");
    expect(pdfComprobanteLetter({ kind: "FACTURA", letter: "B" })).toBe("B");
    expect(pdfComprobanteLetter({ kind: "NOTA_CREDITO", letter: "A" })).toBe("A");
    expect(pdfComprobanteLetter({ kind: "NOTA_DEBITO", letter: "B" })).toBe("B");
    expect(pdfComprobanteLetter({ kind: "RECIBO" })).toBe("X");
  });
});

describe("pdfComprobanteCodeLabel", () => {
  it("mapea códigos AFIP/ARCA y Recibo X interno", () => {
    const cases: Array<[PdfComprobanteBox, string]> = [
      [{ kind: "FACTURA", letter: "A" }, "COD. 001"],
      [{ kind: "FACTURA", letter: "B" }, "COD. 006"],
      [{ kind: "NOTA_DEBITO", letter: "A" }, "COD. 002"],
      [{ kind: "NOTA_DEBITO", letter: "B" }, "COD. 007"],
      [{ kind: "NOTA_CREDITO", letter: "A" }, "COD. 003"],
      [{ kind: "NOTA_CREDITO", letter: "B" }, "COD. 008"],
      [{ kind: "RECIBO" }, "RECIBO X"],
    ];

    for (const [box, label] of cases) {
      expect(pdfComprobanteCodeLabel(box)).toBe(label);
    }
  });
});

describe("comprobanteLetterBoxX", () => {
  it("centra el box en el ancho A4", () => {
    expect(comprobanteLetterBoxX()).toBeCloseTo(
      (A4_WIDTH - COMPROBANTE_LETTER_BOX_WIDTH) / 2,
    );
  });
});

describe("drawComprobanteLetterBox", () => {
  it("dibuja el box centrado en la parte superior", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const topY = A4_HEIGHT - 36;

    const layout = drawComprobanteLetterBox(
      page,
      font,
      bold,
      { kind: "FACTURA", letter: "A" },
      topY,
    );

    expect(layout.boxX + layout.width / 2).toBeCloseTo(A4_WIDTH / 2);
    expect(layout.boxY).toBe(topY - COMPROBANTE_LETTER_BOX_HEIGHT);
    expect(layout.width).toBe(COMPROBANTE_LETTER_BOX_WIDTH);
    expect(layout.rightX).toBeGreaterThan(layout.boxX + layout.width);
  });
});
