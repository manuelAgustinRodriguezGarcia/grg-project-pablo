import { describe, expect, it } from "vitest";
import {
  buildArcaQrPayload,
  buildArcaQrUrl,
  decodeArcaQrUrl,
  type ArcaQrSource,
} from "@/server/arca/qr/build-arca-qr";
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

  it("genera un PNG sin salir a la red", async () => {
    const png = await renderArcaQrPng(buildArcaQrUrl(facturaB()));

    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(200);
  });
});
