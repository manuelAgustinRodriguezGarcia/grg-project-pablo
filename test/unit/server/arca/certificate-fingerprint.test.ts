import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { fingerprintArcaCertificate } from "@/server/arca/tickets/certificate-fingerprint";
import { getTestCredentialPair } from "./wsaa-fixtures";

function anotherCertificatePem(): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "02";
  certificate.validity.notBefore = new Date("2026-01-01T00:00:00.000Z");
  certificate.validity.notAfter = new Date("2027-01-01T00:00:00.000Z");
  const attributes = [{ name: "commonName", value: "wsaa-test-other.local" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(certificate);
}

describe("fingerprintArcaCertificate", () => {
  it("repite el fingerprint para el mismo certificado", () => {
    const pem = getTestCredentialPair().certificatePem;
    expect(fingerprintArcaCertificate(pem)).toBe(fingerprintArcaCertificate(pem));
    expect(fingerprintArcaCertificate(pem)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("cambia el fingerprint si el certificado es otro", () => {
    const first = fingerprintArcaCertificate(getTestCredentialPair().certificatePem);
    const second = fingerprintArcaCertificate(anotherCertificatePem());
    expect(second).not.toBe(first);
  });

  it("rechaza un certificado inválido sin incluir el PEM", () => {
    const invalid = "-----BEGIN CERTIFICATE-----\nno-es-der\n-----END CERTIFICATE-----";

    expect(() => fingerprintArcaCertificate(invalid)).toThrow(ArcaConfigurationError);
    expect(() => fingerprintArcaCertificate(invalid)).toThrowError(
      expect.objectContaining({ code: "CERTIFICADO_INVALIDO" }),
    );

    try {
      fingerprintArcaCertificate(invalid);
    } catch (error) {
      expect((error as Error).message).not.toContain("no-es-der");
    }
  });
});
