import { describe, expect, it } from "vitest";
import {
  identityFirstLineY,
  PDF_HEADER_IDENTITY_LINE_GAP,
} from "@/server/pdf/billing-pdf-header";
import {
  DEFAULT_PDF_ISSUER,
  issuerIdentityLines,
} from "@/server/pdf/invoice-pdf-issuer";

describe("identityFirstLineY", () => {
  it("alinea la última línea del domicilio con la última línea fiscal", () => {
    const lastRightLineY = 700;
    const firstY = identityFirstLineY({
      lastRightLineY,
      lineCount: 3,
    });

    expect(firstY).toBe(lastRightLineY + 2 * PDF_HEADER_IDENTITY_LINE_GAP);
    expect(firstY - 2 * PDF_HEADER_IDENTITY_LINE_GAP).toBe(lastRightLineY);
  });

  it("no desplaza el bloque si no hay líneas", () => {
    expect(
      identityFirstLineY({ lastRightLineY: 640, lineCount: 0 }),
    ).toBe(640);
  });
});

describe("issuerIdentityLines", () => {
  it("devuelve razón social, calle y localidad", () => {
    expect(issuerIdentityLines(DEFAULT_PDF_ISSUER)).toEqual([
      "Rothamel Repuestos S.H",
      "Calle XXXXX",
      "PAMPA DEL INFIERNO, CHACO",
    ]);
  });
});
