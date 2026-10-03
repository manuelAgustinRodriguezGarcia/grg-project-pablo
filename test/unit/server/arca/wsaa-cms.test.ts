import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { buildLoginTicketRequest } from "@/server/arca/wsaa/build-tra";
import { signLoginTicketRequest } from "@/server/arca/wsaa/sign-tra";
import {
  createUnrelatedPrivateKeyPem,
  getTestCredentialPair,
} from "./wsaa-fixtures";

const SHA1_OID = Buffer.from([0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a]);
const SHA256_OID = Buffer.from([
  0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
]);

function cmsDer(cmsBase64: string): Buffer {
  return Buffer.from(forge.util.decode64(cmsBase64), "binary");
}

function readCertificates(cmsBase64: string): forge.pki.Certificate[] {
  const message = forge.pkcs7.messageFromAsn1(
    forge.asn1.fromDer(forge.util.decode64(cmsBase64)),
  );

  if (!("certificates" in message)) {
    throw new Error("El CMS de prueba no es SignedData.");
  }

  return message.certificates;
}

describe("signLoginTicketRequest", () => {
  it("firma el TRA como CMS DER en Base64, con el certificado y sin la clave", () => {
    const pair = getTestCredentialPair();
    const tra = buildLoginTicketRequest({
      service: "wsfe",
      now: new Date("2026-09-29T04:00:00.000Z"),
    });
    const cmsBase64 = signLoginTicketRequest({
      traXml: tra.xml,
      certificatePem: pair.certificatePem,
      privateKeyPem: pair.privateKeyPem,
    });

    expect(cmsBase64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(cmsBase64.includes("BEGIN CMS")).toBe(false);
    expect(cmsBase64.includes("BEGIN PKCS7")).toBe(false);
    expect(cmsBase64.includes("PRIVATE KEY")).toBe(false);
    expect(cmsBase64.includes(pair.privateKeyPem)).toBe(false);

    const der = cmsDer(cmsBase64);
    expect(der.includes(SHA1_OID)).toBe(true);
    expect(der.includes(SHA256_OID)).toBe(false);
    expect(der.toString("latin1")).toContain(tra.xml);

    const certificates = readCertificates(cmsBase64);
    expect(certificates).toHaveLength(1);
    expect(forge.pki.certificateToPem(certificates[0]!).replace(/\r\n/g, "\n")).toBe(
      pair.certificatePem.replace(/\r\n/g, "\n"),
    );
  });

  it("rechaza una clave privada que no corresponde al certificado", () => {
    const pair = getTestCredentialPair();
    const tra = buildLoginTicketRequest({
      service: "wsfe",
      now: new Date("2026-09-29T04:00:00.000Z"),
    });

    expect(() =>
      signLoginTicketRequest({
        traXml: tra.xml,
        certificatePem: pair.certificatePem,
        privateKeyPem: createUnrelatedPrivateKeyPem(),
      }),
    ).toThrow(ArcaWsaaError);
    expect(() =>
      signLoginTicketRequest({
        traXml: tra.xml,
        certificatePem: pair.certificatePem,
        privateKeyPem: createUnrelatedPrivateKeyPem(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "CMS_ERROR" }),
    );
  });
});
