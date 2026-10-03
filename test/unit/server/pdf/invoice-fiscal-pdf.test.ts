import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildArcaQrPayload } from "@/server/arca/qr/build-arca-qr";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import { buildInvoicePdf } from "@/server/pdf/build-invoice-pdf";
import type { InvoicePdfInput } from "@/server/pdf/invoice-pdf.types";

const ISSUED_AT = new Date("2026-10-01T15:00:00.000Z");
const CAE = "71234567890123";

function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamAt = buffer.indexOf("stream", cursor);

    if (streamAt < 0) {
      break;
    }

    let dataStart = streamAt + "stream".length;

    if (buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    if (buffer[dataStart] === 0x0a) {
      dataStart += 1;
    }

    const end = buffer.indexOf("endstream", dataStart);

    if (end < 0) {
      break;
    }

    let dataEnd = end;

    if (buffer[dataEnd - 1] === 0x0a) {
      dataEnd -= 1;
    }

    if (buffer[dataEnd - 1] === 0x0d) {
      dataEnd -= 1;
    }

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

function invoice(overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
  return {
    invoiceType: "B",
    invoiceNumber: "0007-00000003",
    pointOfSale: "0007",
    sequenceNumber: 3,
    issuedAt: ISSUED_AT,
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    cae: CAE,
    caeExpiresAt: new Date(Date.UTC(2026, 9, 11)),
    issuerPlaceholders: false,
    clientName: "CONSUMIDOR FINAL HOMOLOGACION",
    clientCode: "CF-HOMO",
    clientAddress: "Prueba 1234",
    clientCity: "Prueba",
    clientProvince: "Chaco",
    clientIdentificationType: "NINGUNO",
    clientIdentificationNumber: null,
    clientIvaCondition: "CONSUMIDOR_FINAL",
    items: [
      {
        rubroCode: "PR-HOMO",
        description: "PRUEBA HOMOLOGACION",
        quantity: 1,
        unitPrice: 1210,
        lineTotal: 1210,
      },
    ],
    subtotal: 1210,
    discountPercent: 0,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 210,
    total: 1210,
    totalVisualRounded: 1210,
    paymentMethod: "CONTADO",
    notes: null,
    issuer: {
      name: "Rothamel Repuestos",
      cuit: "30712345671",
      address: "Ruta 89 km 4",
      city: "Pampa del Infierno",
      province: "Chaco",
      ivaCondition: "Responsable Inscripto",
      grossIncome: "IIBB-123456",
      activitiesStartedAt: "2004-03-15",
    },
    logoPng: null,
    ...overrides,
  };
}

describe("PDF fiscal de factura", () => {
  it("mantiene la marca de modo prueba y no incluye CAE ni QR", async () => {
    const bytes = await buildInvoicePdf(
      invoice({
        environment: "MODO_PRUEBA",
        fiscalStatus: "MODO_PRUEBA",
        invoiceNumber: "0007-PRUEBA-000000001",
        cae: null,
        caeExpiresAt: null,
        issuerPlaceholders: true,
      }),
    );
    const text = pdfText(bytes);

    expect(text).toContain("MODO PRUEBA - NO VALIDO COMO FACTURA FISCAL");
    expect(text).toContain("Sin CAE ni QR fiscal");
    expect(text).not.toContain(CAE);
    expect(text).not.toContain("www.arca.gob.ar");
    expect(text).not.toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(text).not.toMatch(/\/[A-Za-z0-9.-]+\s+Do/);
  });

  it("incluye CAE, vencimiento, QR y leyenda de homologación en Factura B", async () => {
    const bytes = await buildInvoicePdf(invoice());
    const text = pdfText(bytes);

    expect(text).toContain(`CAE: ${CAE}`);
    expect(text).toContain("Vto. CAE: 11/10/2026");
    expect(text).toContain("COD. 006");
    expect(text).toContain("Rothamel Repuestos");
    expect(text).toContain("Ruta 89 km 4");
    expect(text).toContain("PAMPA DEL INFIERNO, CHACO");
    expect(text).toContain("Condición frente al IVA: Responsable Inscripto");
    expect(text).toContain("CUIT: 30-71234567-1");
    expect(text).not.toContain("CUIT: 30712345671");
    expect(text).toContain("Ingresos Brutos: IIBB-123456");
    expect(text).toContain("Inicio de actividades: 15/03/2004");
    expect(text).toContain("Forma de pago: CONTADO");
    expect(text).not.toContain("Tipo de factura");
    expect(text).toContain("Condición IVA: Consumidor Final");
    expect(text).toContain("A CONSUMIDOR FINAL");
    expect(text).toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(text).toContain("CONSUMIDOR FINAL HOMOLOGACION");
    expect(text).not.toContain("MODO PRUEBA");
    expect(text).toMatch(/\/[A-Za-z0-9.-]+\s+Do/);
    expect(text).toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(buildArcaQrPayload({
      environment: "HOMOLOGACION",
      fiscalStatus: "AUTORIZADA",
      cae: CAE,
      pointOfSale: "0007",
      sequenceNumber: 3,
      invoiceType: "B",
      total: 1210,
      issuedAt: ISSUED_AT,
      issuerCuit: "30712345671",
      clientIdentificationType: "NINGUNO",
      clientIdentificationNumber: null,
    }).importe).toBe(1210);
  });

  it("usa el código 001 en Factura A y conserva el nombre del snapshot", async () => {
    const bytes = await buildInvoicePdf(
      invoice({
        invoiceType: "A",
        clientName: "GOMEZ SRL",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30500010912",
        clientIvaCondition: "RESPONSABLE_INSCRIPTO",
      }),
    );
    const text = pdfText(bytes);

    expect(text).toContain("COD. 001");
    expect(text).toContain("GOMEZ SRL");
    expect(text).toContain("Forma de pago: CONTADO");
    expect(text).toContain("CUIT: 30-71234567-1");
    expect(text).not.toContain("A CONSUMIDOR FINAL");
    expect(text).not.toContain("Calle XXXXX");
    expect(text).not.toContain("XX-XXXXXXXX-X");
  });

  it("no genera el PDF fiscal si falta el CAE", async () => {
    await expect(buildInvoicePdf(invoice({ cae: null }))).rejects.toBeInstanceOf(
      ArcaQrError,
    );
  });

  it("produccion autorizada lleva CAE y no la leyenda de homologación", async () => {
    const bytes = await buildInvoicePdf(
      invoice({ environment: "PRODUCCION" }),
    );
    const text = pdfText(bytes);

    expect(text).toContain(`CAE: ${CAE}`);
    expect(text).not.toContain("HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN");
    expect(text).not.toContain("MODO PRUEBA");
  });
});
