import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import { buildNotePdf, type NotePdfInput } from "@/server/pdf/build-note-pdf";

const CAE = "71234567890123";
const ISSUED_AT = new Date("2026-10-03T15:00:00.000Z");
const ASSOCIATED_AT = new Date(2026, 8, 30);

function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamAt = buffer.indexOf("stream", cursor);
    if (streamAt < 0) break;
    let dataStart = streamAt + "stream".length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf("endstream", dataStart);
    if (end < 0) break;
    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
    const slice = buffer.subarray(dataStart, dataEnd);
    try {
      parts.push(inflateSync(slice).toString("latin1"));
    } catch {
      parts.push(slice.toString("latin1"));
    }
    cursor = end + "endstream".length;
  }

  return parts
    .join("\n")
    .replace(/<([0-9A-Fa-f\s]+)>/g, (token, hex: string) => {
      const clean = hex.replace(/\s/g, "");

      if (clean.length === 0 || clean.length % 2 !== 0) {
        return token;
      }

      return Buffer.from(clean, "hex").toString("latin1");
    });
}

function fiscalNote(overrides: Partial<NotePdfInput> = {}): NotePdfInput {
  return {
    kind: "CREDIT",
    noteNumber: "0007-00000012",
    invoiceType: "A",
    invoiceNumber: "0007-00000009",
    issuedAt: ISSUED_AT,
    amount: 200,
    netAmount: 165.29,
    ivaAmount: 34.71,
    ivaPercent: 21,
    reason: "Ajuste comercial",
    clientName: "CLIENTE SNAPSHOT SA",
    clientCode: "CLI-0009",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    issuer: {
      name: "EMISOR GUARDADO",
      cuit: "30712345671",
      address: "Ruta 89 km 4",
      city: "Pampa del Infierno",
      province: "Chaco",
      ivaCondition: "Responsable Inscripto",
      grossIncome: "IIBB-123456",
      activitiesStartedAt: "2004-03-15",
    },
    logoPng: null,
    environment: "PRODUCCION",
    fiscalStatus: "AUTORIZADA",
    pointOfSale: "0007",
    sequenceNumber: 12,
    voucherType: 3,
    cae: CAE,
    caeExpiresAt: new Date(Date.UTC(2026, 9, 11)),
    associatedIssuedAt: ASSOCIATED_AT,
    ...overrides,
  };
}

describe("PDF fiscal de nota", () => {
  it.each([
    ["CREDIT", "A", 3, "COD. 003"],
    ["DEBIT", "A", 2, "COD. 002"],
    ["CREDIT", "B", 8, "COD. 008"],
    ["DEBIT", "B", 7, "COD. 007"],
  ] as const)("producción %s %s muestra %s", async (kind, invoiceType, voucherType, code) => {
    const bytes = await buildNotePdf(
      fiscalNote({
        kind,
        invoiceType,
        voucherType,
        clientIdentificationType: invoiceType === "B" ? "NINGUNO" : "CUIT",
        clientIdentificationNumber: invoiceType === "B" ? null : "30500010912",
        clientIvaCondition: invoiceType === "B" ? "CONSUMIDOR_FINAL" : "RESPONSABLE_INSCRIPTO",
      }),
    );
    const text = pdfText(bytes);

    expect(text).toContain(code);
    expect(text).toContain(`CAE: ${CAE}`);
    expect(text).toContain("Vto. CAE: 11/10/2026");
    expect(text).toContain("Comprobante asociado");
    expect(text).toContain(`Factura ${invoiceType} 0007-00000009`);
    expect(text).toContain("30/09/2026");
    expect(text).toContain("CLIENTE SNAPSHOT SA");
    expect(text).toContain("EMISOR GUARDADO");
    expect(text).not.toContain("Emitida por");
    expect(text).not.toContain("invoice-1");
    expect(text).not.toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(text).not.toContain("MODO PRUEBA");
    expect(text).toMatch(/\/[A-Za-z0-9.-]+\s+Do/);
  });

  it("homologación muestra el banner y no el número de prueba", async () => {
    const text = pdfText(
      await buildNotePdf(fiscalNote({ environment: "HOMOLOGACION" })),
    );

    expect(text).toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(text).toContain("0007-00000012");
    expect(text).not.toContain("PRUEBA");
    expect(text).toContain(`CAE: ${CAE}`);
  });

  it("una nota interna de modo prueba no muestra CAE ni QR", async () => {
    const text = pdfText(
      await buildNotePdf(
        fiscalNote({
          environment: "MODO_PRUEBA",
          fiscalStatus: "INTERNA",
          noteNumber: "0007-PRUEBA-NC-000000001",
          invoiceNumber: "0007-PRUEBA-000000001",
          cae: CAE,
          voucherType: null,
          sequenceNumber: 1,
        }),
      ),
    );

    expect(text).toContain("MODO PRUEBA - NO VALIDO COMO COMPROBANTE FISCAL");
    expect(text).not.toContain("Emitida por");
    expect(text).not.toContain(`CAE: ${CAE}`);
    expect(text).not.toContain("Comprobante asociado");
    expect(text).not.toMatch(/\/[A-Za-z0-9.-]+\s+Do/);
  });

  it.each([
    [{ cae: null }, /CAE/],
    [{ voucherType: null }, /tipo de comprobante/],
    [{ voucherType: 8 }, /tipo de comprobante/],
    [{ sequenceNumber: 0 }, /número de comprobante/],
    [{ pointOfSale: " " }, /punto de venta/],
    [{ pointOfSale: "12A" }, /punto de venta/],
    [{ clientIvaCondition: undefined }, /IVA/],
  ] as const)("una nota autorizada incompleta falla: %j", async (overrides, message) => {
    await expect(buildNotePdf(fiscalNote(overrides))).rejects.toBeInstanceOf(ArcaQrError);
    await expect(buildNotePdf(fiscalNote(overrides))).rejects.toThrow(message);
  });
});
