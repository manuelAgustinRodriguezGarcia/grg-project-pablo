import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import {
  getArcaCertificate,
  getArcaPrivateKey,
} from "@/server/arca/config/credentials";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";

const DUMMY_CERTIFICATE = `-----BEGIN CERTIFICATE-----
DUMMY-CERT
-----END CERTIFICATE-----
`;

const PROD_CERTIFICATE = `-----BEGIN CERTIFICATE-----
PROD-CERT
-----END CERTIFICATE-----
`;

const DUMMY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
DUMMY-KEY
-----END PRIVATE KEY-----
`;

const PROD_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
PROD-KEY
-----END PRIVATE KEY-----
`;

function encodePem(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

const ENV_KEYS = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  "ARCA_PROD_CERT_B64",
  "ARCA_PROD_PRIVATE_KEY_B64",
] as const;

function clearArcaEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearArcaEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearArcaEnv();
});

describe("resolveArcaEndpoints", () => {
  it("resuelve homologación sin abrir red", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(resolveArcaEndpoints("HOMOLOGACION")).toEqual({
      wsaaUrl: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
      wsfeUrl: "https://wswhomo.afip.gob.ar/wsfev1/service.asmx",
      service: "wsfe",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resuelve producción sin abrir red", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(resolveArcaEndpoints("PRODUCCION")).toEqual({
      wsaaUrl: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
      wsfeUrl: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
      service: "wsfe",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no resuelve endpoints en modo prueba interno", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(() => resolveArcaEndpoints("MODO_PRUEBA")).toThrow(
      ArcaConfigurationError,
    );
    expect(() => resolveArcaEndpoints("MODO_PRUEBA")).toThrow(
      expect.objectContaining({ code: "AMBIENTE_NO_SOPORTADO" }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("credenciales ARCA", () => {
  it("decodifica el certificado Base64 de homologación", () => {
    vi.stubEnv("ARCA_HOMO_CERT_B64", encodePem(DUMMY_CERTIFICATE));

    expect(getArcaCertificate("HOMOLOGACION")).toBe(DUMMY_CERTIFICATE.trim());
  });

  it("decodifica la private key Base64 de homologación", () => {
    vi.stubEnv("ARCA_HOMO_PRIVATE_KEY_B64", encodePem(DUMMY_PRIVATE_KEY));

    expect(getArcaPrivateKey("HOMOLOGACION")).toBe(DUMMY_PRIVATE_KEY.trim());
  });

  it("producción lee su certificado y homologación el propio", () => {
    vi.stubEnv("ARCA_HOMO_CERT_B64", encodePem(DUMMY_CERTIFICATE));
    vi.stubEnv("ARCA_PROD_CERT_B64", encodePem(PROD_CERTIFICATE));

    expect(getArcaCertificate("PRODUCCION")).toBe(PROD_CERTIFICATE.trim());
    expect(getArcaCertificate("HOMOLOGACION")).toBe(DUMMY_CERTIFICATE.trim());
  });

  it("producción lee su private key y homologación la propia", () => {
    vi.stubEnv("ARCA_HOMO_PRIVATE_KEY_B64", encodePem(DUMMY_PRIVATE_KEY));
    vi.stubEnv("ARCA_PROD_PRIVATE_KEY_B64", encodePem(PROD_PRIVATE_KEY));

    expect(getArcaPrivateKey("PRODUCCION")).toBe(PROD_PRIVATE_KEY.trim());
    expect(getArcaPrivateKey("HOMOLOGACION")).toBe(DUMMY_PRIVATE_KEY.trim());
  });

  it("acepta un PEM RSA dummy sin exponerlo", () => {
    const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
DUMMY-RSA
-----END RSA PRIVATE KEY-----`;
    vi.stubEnv("ARCA_PROD_PRIVATE_KEY_B64", encodePem(rsaKey));

    expect(getArcaPrivateKey("PRODUCCION")).toBe(rsaKey);
  });

  it("falla si falta el certificado", () => {
    expect(() => getArcaCertificate("HOMOLOGACION")).toThrow(
      expect.objectContaining({ code: "CERTIFICADO_AUSENTE" }),
    );
  });

  it("falla si falta la private key", () => {
    expect(() => getArcaPrivateKey("PRODUCCION")).toThrow(
      expect.objectContaining({ code: "PRIVATE_KEY_AUSENTE" }),
    );
  });

  it("no incluye el PEM en el error de certificado inválido", () => {
    vi.stubEnv("ARCA_HOMO_CERT_B64", encodePem("no-es-un-pem"));

    expect(() => getArcaCertificate("HOMOLOGACION")).toThrow(
      expect.objectContaining({ code: "CERTIFICADO_INVALIDO" }),
    );

    try {
      getArcaCertificate("HOMOLOGACION");
    } catch (error) {
      expect(error).toBeInstanceOf(ArcaConfigurationError);
      expect((error as Error).message).not.toContain("no-es-un-pem");
      expect((error as Error).message).not.toContain("BEGIN");
    }
  });
});

describe("normalizeIssuerCuit", () => {
  it("deja solo los 11 dígitos", () => {
    expect(normalizeIssuerCuit("20-12345678-9")).toBe("20123456789");
    expect(normalizeIssuerCuit(" 20 12345678 9 ")).toBe("20123456789");
  });

  it("falla si falta o no tiene 11 dígitos", () => {
    expect(() => normalizeIssuerCuit(null)).toThrow(
      expect.objectContaining({ code: "CUIT_INVALIDO" }),
    );
    expect(() => normalizeIssuerCuit("")).toThrow(
      expect.objectContaining({ code: "CUIT_INVALIDO" }),
    );
    expect(() => normalizeIssuerCuit("20-1234567-9")).toThrow(
      expect.objectContaining({ code: "CUIT_INVALIDO" }),
    );
  });
});

describe("parseArcaPointOfSale", () => {
  it("convierte 0007 en 7", () => {
    expect(parseArcaPointOfSale("0007")).toBe(7);
  });

  it("falla si el punto de venta no es válido", () => {
    expect(() => parseArcaPointOfSale("0000")).toThrow(
      expect.objectContaining({ code: "PUNTO_DE_VENTA_INVALIDO" }),
    );
    expect(() => parseArcaPointOfSale("7A")).toThrow(
      expect.objectContaining({ code: "PUNTO_DE_VENTA_INVALIDO" }),
    );
    expect(() => parseArcaPointOfSale("")).toThrow(
      expect.objectContaining({ code: "PUNTO_DE_VENTA_INVALIDO" }),
    );
  });
});
