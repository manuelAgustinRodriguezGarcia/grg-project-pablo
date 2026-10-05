import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type {
  LibroIvaInvoiceSource,
  LibroIvaNoteSource,
} from "@/features/billing/utils/libro-iva";
import {
  ArtifactAbort,
  assertExpectedBalance,
  assertNotePdfText,
  assertSingleMatch,
  assertVerifyArtifactsArgs,
  assessHomologationLibro,
  formatQrVerification,
  pdfText,
} from "../../../scripts/arca-homo-verify-note-artifacts-plan";

const CAE = "71234567890123";
const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";

function invoiceSource(
  overrides: Partial<LibroIvaInvoiceSource> = {},
): LibroIvaInvoiceSource {
  return {
    issuedAt: new Date("2026-10-05T12:00:00.000Z"),
    invoiceType: "A",
    pointOfSale: "0007",
    invoiceNumber: "0007-00000001",
    clientName: "Cliente",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotal: 1000,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 210,
    total: 1210,
    totalVisualRounded: 1210,
    ...overrides,
  };
}

function noteSource(overrides: Partial<LibroIvaNoteSource> = {}): LibroIvaNoteSource {
  return {
    kind: "CREDIT",
    issuedAt: new Date("2026-10-05T15:00:00.000Z"),
    invoiceType: "A",
    pointOfSale: "0007",
    noteNumber: "0007-00000001",
    invoiceNumber: "0007-00000001",
    clientName: "Cliente",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    netAmount: 100,
    ivaPercent: 21,
    ivaAmount: 21,
    amount: 121,
    ...overrides,
  };
}

function qrInput(overrides: Partial<Parameters<typeof formatQrVerification>[0]> = {}) {
  return {
    ver: 1,
    fecha: "2026-10-05",
    cuit: Number(ISSUER_CUIT),
    ptoVta: 7,
    tipoCmp: 3,
    nroCmp: 1,
    importe: 121,
    moneda: "PES",
    ctz: 1,
    tipoCodAut: "E",
    codAut: Number(CAE),
    tipoDocRec: 80,
    nroDocRec: Number(CLIENT_CUIT),
    expectedFecha: "2026-10-05",
    expectedCaeDigits: CAE,
    expectedIssuerCuitDigits: ISSUER_CUIT,
    expectedReceptorDigits: CLIENT_CUIT,
    expectedReceptorDocType: 80,
    ...overrides,
  };
}

describe("identidad fiscal", () => {
  it("aborta si hay más de una coincidencia", () => {
    expect(() => assertSingleMatch([1, 2], "la nota")).toThrow(/más de una/);
  });

  it("aborta un argumento de producción", () => {
    expect(() => assertVerifyArtifactsArgs(["--environment=PRODUCCION"])).toThrow(
      /PRODUCCION/,
    );
  });
});

describe("QR y PDF", () => {
  it("informa el QR sin imprimir CAE ni CUIT", () => {
    const text = formatQrVerification(qrInput());

    expect(text).toContain("QR válido: sí");
    expect(text).toContain("tipoCmp: 3");
    expect(text).toContain("ptoVta: 7");
    expect(text).toContain("nroCmp: 1");
    expect(text).toContain("importe: 121.00");
    expect(text).toContain("tipoCodAut: E");
    expect(text).toContain("documento receptor: sí");
    expect(text).toContain("CAE coincide: sí");
    expect(text).not.toContain(CAE);
    expect(text).not.toContain(ISSUER_CUIT);
    expect(text).not.toContain(CLIENT_CUIT);
  });

  it("rechaza un QR de otro tipo", () => {
    expect(() => formatQrVerification(qrInput({ tipoCmp: 1 }))).toThrow(ArtifactAbort);
  });

  it("lee el texto de un PDF y no devuelve el CAE en el resumen", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage();
    const lines = [
      "NOTA DE CRÉDITO",
      "COD. 003",
      "0007-00000001",
      "HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN",
      `CAE: ${CAE}`,
      "Vto. CAE: 15/10/2026",
      "Comprobante asociado",
      "Factura A 0007-00000001",
      "$121,00",
      "Neto $100,00",
      "IVA 21% $21,00",
      "PRUEBA HOMOLOGACION NC",
      "EMISOR",
      "CLIENTE",
    ];

    lines.forEach((line, index) => {
      page.drawText(line, { x: 40, y: 800 - index * 16, size: 10, font });
    });

    const report = assertNotePdfText({
      text: pdfText(await pdf.save()),
      cae: CAE,
      expiration: "15/10/2026",
      issuerName: "EMISOR",
      clientName: "CLIENTE",
      amountLabel: "$121,00",
      netLabel: "Neto $100,00",
      ivaLabel: "IVA 21% $21,00",
    });

    expect(report).toContain("CAE presente: sí");
    expect(report).not.toContain(CAE);
  });
});

describe("libro y saldo", () => {
  it("cierra el par de octubre en 900 / 189 / 1089", () => {
    const assessment = assessHomologationLibro([invoiceSource()], [noteSource()]);

    expect(assessment.onlyKnownPair).toBe(true);
    expect(assessment.totals).toEqual({ netAmount: 900, ivaAmount: 189, total: 1089 });
    expect(assessment.lines.some((line) => line.startsWith("NC A"))).toBe(true);
    expect(assessment.lines.join("\n")).not.toContain(CLIENT_CUIT);
  });

  it("no asume 900 cuando hay otro documento", () => {
    const assessment = assessHomologationLibro(
      [invoiceSource(), invoiceSource({ invoiceNumber: "0007-00000002", totalVisualRounded: 242 })],
      [noteSource()],
    );

    expect(assessment.onlyKnownPair).toBe(false);
    expect(assessment.totals.total).not.toBe(1089);
    expect(assessment.lines.some((line) => line.includes("0007-00000002"))).toBe(true);
  });

  it("exige 121000 - 12100 = 108900 con la factura autorizada", () => {
    expect(
      assertExpectedBalance({
        totalCents: 121_000,
        creditCents: 12_100,
        debitCents: 0,
        allocatedCents: 0,
        fiscalStatus: "AUTORIZADA",
      }),
    ).toBe(108_900);
  });
});

describe("el script sigue siendo de lectura", () => {
  it("no llama WSAA, WSFE ni escribe comprobantes", () => {
    const source = readFileSync("scripts/arca-homo-verify-note-artifacts.ts", "utf8");

    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getValidArcaAccessTicket");
    expect(source).not.toContain("FECompConsultar");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("getOrCreate");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".create(");
    expect(source).toContain("installFetchGuard");
    expect(source).toContain("buildNotePdf");
    expect(source).toContain("buildLibroIvaRows");
    expect(source).toContain("buildLibroIvaPdf");
    expect(source).toContain("buildLibroIvaXlsx");
  });
});
