import { describe, expect, it } from "vitest";
import {
  invoiceFiscalStatusFromNotes,
  persistedFiscalStatusAfterSettlement,
} from "@/features/billing/utils/invoice-settlement";
import {
  buildArcaNoteQrPayload,
  buildArcaQrPayload,
  buildArcaQrUrl,
  decodeArcaQrUrl,
  type ArcaNoteQrSource,
  type ArcaQrSource,
} from "@/server/arca/qr/build-arca-qr";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import { renderArcaQrPng } from "@/server/arca/qr/render-arca-qr-png";

const ISSUED_AT = new Date("2026-10-01T15:00:00.000Z");
const CAE = "71234567890123";
const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";

function facturaB(overrides: Partial<ArcaQrSource> = {}): ArcaQrSource {
  return {
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    cae: CAE,
    pointOfSale: "0007",
    sequenceNumber: 3,
    invoiceType: "B",
    total: 1210,
    issuedAt: ISSUED_AT,
    issuerCuit: ISSUER_CUIT,
    clientIdentificationType: "NINGUNO",
    clientIdentificationNumber: null,
    ...overrides,
  };
}

describe("QR fiscal ARCA", () => {
  it("arma la Factura B 0007-00000003 sin documento de receptor", () => {
    const payload = buildArcaQrPayload(facturaB());

    expect(payload).toEqual({
      ver: 1,
      fecha: "2026-10-01",
      cuit: 30712345671,
      ptoVta: 7,
      tipoCmp: 6,
      nroCmp: 3,
      importe: 1210,
      moneda: "PES",
      ctz: 1,
      tipoCodAut: "E",
      codAut: 71234567890123,
    });
    expect(payload).not.toHaveProperty("tipoDocRec");
    expect(payload).not.toHaveProperty("nroDocRec");
    expect(payload.codAut).not.toBe(20261010);
  });

  it("mantiene el CUIT numérico aunque se muestre con guiones", () => {
    const payload = buildArcaQrPayload(
      facturaB({ issuerCuit: "30-71234567-1" }),
    );

    expect(payload.cuit).toBe(30712345671);
    expect(payload.importe).toBe(1210);
    expect(JSON.stringify(payload)).not.toContain("30-71234567-1");
  });

  it("usa el total fiscal y no el total visual", () => {
    const payload = buildArcaQrPayload(facturaB({ total: 1210 }));

    expect(payload.importe).toBe(1210);
    expect(payload).not.toHaveProperty("totalVisualRounded");
  });

  it("decodifica el Base64 estándar al mismo JSON", () => {
    const source = facturaB();
    const url = buildArcaQrUrl(source);

    expect(url.startsWith("https://www.arca.gob.ar/fe/qr/?p=")).toBe(true);
    expect(url).not.toContain("base64url");

    const encoded = url.slice("https://www.arca.gob.ar/fe/qr/?p=".length);
    expect(encoded).toBe(
      Buffer.from(JSON.stringify(buildArcaQrPayload(source)), "utf8").toString(
        "base64",
      ),
    );
    expect(encoded.includes("-") || encoded.includes("_")).toBe(false);
    expect(decodeArcaQrUrl(url)).toEqual(buildArcaQrPayload(source));
  });

  it("arma Factura A con CUIT del receptor", () => {
    const payload = buildArcaQrPayload(
      facturaB({
        invoiceType: "A",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30-50001091-2",
      }),
    );

    expect(payload.tipoCmp).toBe(1);
    expect(payload.tipoDocRec).toBe(80);
    expect(payload.nroDocRec).toBe(Number(CLIENT_CUIT));
    expect(Object.keys(payload)).toEqual([
      "ver",
      "fecha",
      "cuit",
      "ptoVta",
      "tipoCmp",
      "nroCmp",
      "importe",
      "moneda",
      "ctz",
      "tipoDocRec",
      "nroDocRec",
      "tipoCodAut",
      "codAut",
    ]);
  });

  it("arma DNI como documento 96", () => {
    const payload = buildArcaQrPayload(
      facturaB({
        clientIdentificationType: "DNI",
        clientIdentificationNumber: "12.345.678",
      }),
    );

    expect(payload.tipoDocRec).toBe(96);
    expect(payload.nroDocRec).toBe(12345678);
  });

  it("no arma un QR fiscal si falta el CAE", () => {
    expect(() => buildArcaQrPayload(facturaB({ cae: null }))).toThrow(
      ArcaQrError,
    );
    expect(() => buildArcaQrPayload(facturaB({ cae: null }))).toThrow(
      /CAE/,
    );
  });

  it("no arma un QR de modo prueba", () => {
    expect(() =>
      buildArcaQrPayload(facturaB({ environment: "MODO_PRUEBA" })),
    ).toThrow(ArcaQrError);
  });

  it("sigue regenerando el QR si la factura autorizada recibió una nota", () => {
    const total = pesosToCents(1210);
    const commercial = invoiceFiscalStatusFromNotes(total, 0, total);
    const persisted = persistedFiscalStatusAfterSettlement(
      "AUTORIZADA",
      commercial,
    );

    expect(commercial).toBe("ANULADA_NC");
    expect(persisted).toBe("AUTORIZADA");
    expect(
      buildArcaQrUrl(facturaB({ fiscalStatus: persisted })).startsWith(
        "https://www.arca.gob.ar/fe/qr/?p=",
      ),
    ).toBe(true);
    expect(() =>
      buildArcaQrUrl(facturaB({ fiscalStatus: commercial })),
    ).toThrow(ArcaQrError);
  });

  it("Factura A sigue en tipoCmp 1 y Factura B en tipoCmp 6", () => {
    expect(buildArcaQrPayload(facturaB({ invoiceType: "A" })).tipoCmp).toBe(1);
    expect(buildArcaQrPayload(facturaB()).tipoCmp).toBe(6);
  });

  function nota(
    overrides: Partial<ArcaNoteQrSource> = {},
  ): ArcaNoteQrSource {
    return {
      fiscalStatus: "AUTORIZADA",
      environment: "PRODUCCION",
      kind: "CREDIT",
      invoiceType: "A",
      voucherType: 3,
      cae: CAE,
      pointOfSale: "0007",
      sequenceNumber: 12,
      amount: 200,
      issuedAt: ISSUED_AT,
      issuerCuit: ISSUER_CUIT,
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: CLIENT_CUIT,
      ...overrides,
    };
  }

  it.each([
    ["DEBIT", "A", 2],
    ["CREDIT", "A", 3],
    ["DEBIT", "B", 7],
    ["CREDIT", "B", 8],
  ] as const)("nota %s %s usa tipoCmp %s", (kind, invoiceType, voucherType) => {
    const payload = buildArcaNoteQrPayload(
      nota({
        kind,
        invoiceType,
        voucherType,
        clientIdentificationType: invoiceType === "B" ? "NINGUNO" : "CUIT",
        clientIdentificationNumber: invoiceType === "B" ? null : CLIENT_CUIT,
      }),
    );

    expect(payload.tipoCmp).toBe(voucherType);
    expect(payload.nroCmp).toBe(12);
    expect(payload.codAut).toBe(Number(CAE));
    expect(payload.importe).toBe(200);
  });

  it("una nota B sin documento omite tipoDocRec igual que la factura B", () => {
    const payload = buildArcaNoteQrPayload(
      nota({
        kind: "CREDIT",
        invoiceType: "B",
        voucherType: 8,
        clientIdentificationType: "NINGUNO",
        clientIdentificationNumber: null,
      }),
    );

    expect(payload).not.toHaveProperty("tipoDocRec");
    expect(payload).not.toHaveProperty("nroDocRec");
  });

  it("una nota interna o autorizada sin CAE no genera QR", () => {
    expect(() =>
      buildArcaNoteQrPayload(nota({ fiscalStatus: "INTERNA" })),
    ).toThrow(/interna/);
    expect(() => buildArcaNoteQrPayload(nota({ cae: null }))).toThrow(/CAE/);
  });

  it("genera un PNG sin salir a la red", async () => {
    const png = await renderArcaQrPng(buildArcaQrUrl(facturaB()));

    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(200);
  });
});
