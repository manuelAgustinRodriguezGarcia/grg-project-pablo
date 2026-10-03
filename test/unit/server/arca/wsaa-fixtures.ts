import forge from "node-forge";

export type TestCredentialPair = {
  certificatePem: string;
  privateKeyPem: string;
};

function createPair(): TestCredentialPair {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  const notBefore = new Date("2026-01-01T00:00:00.000Z");
  const notAfter = new Date("2027-01-01T00:00:00.000Z");
  certificate.validity.notBefore = notBefore;
  certificate.validity.notAfter = notAfter;
  const attributes = [{ name: "commonName", value: "wsaa-test.local" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

let cachedPair: TestCredentialPair | null = null;

export function getTestCredentialPair(): TestCredentialPair {
  if (!cachedPair) {
    cachedPair = createPair();
  }

  return cachedPair;
}

export function createUnrelatedPrivateKeyPem(): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  return forge.pki.privateKeyToPem(keys.privateKey);
}

export function pemToBase64(pem: string): string {
  return Buffer.from(pem, "utf8").toString("base64");
}
