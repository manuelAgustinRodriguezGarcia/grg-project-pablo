import "server-only";
import forge from "node-forge";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";

function cmsError(message: string): ArcaWsaaError {
  return new ArcaWsaaError(message, "CMS_ERROR");
}

function parseCertificate(certificatePem: string): forge.pki.Certificate {
  try {
    return forge.pki.certificateFromPem(certificatePem);
  } catch {
    throw cmsError("No se pudo leer el certificado para firmar el TRA.");
  }
}

function parsePrivateKey(privateKeyPem: string): forge.pki.rsa.PrivateKey {
  try {
    return forge.pki.privateKeyFromPem(privateKeyPem);
  } catch {
    throw cmsError("No se pudo leer la clave privada para firmar el TRA.");
  }
}

function privateKeyMatchesCertificate(
  certificate: forge.pki.Certificate,
  privateKey: forge.pki.rsa.PrivateKey,
): boolean {
  const publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;
  return (
    publicKey.n.compareTo(privateKey.n) === 0 &&
    publicKey.e.compareTo(privateKey.e) === 0
  );
}

/**
 * Firma el TRA como CMS PKCS#7 attached (SHA1 + RSA) y devuelve el DER en Base64.
 * No envuelve el resultado en PEM.
 */
export function signLoginTicketRequest(input: {
  traXml: string;
  certificatePem: string;
  privateKeyPem: string;
}): string {
  if (!input.traXml.trim()) {
    throw cmsError("El TRA a firmar está vacío.");
  }

  const sha1 = forge.pki.oids.sha1;
  const contentType = forge.pki.oids.contentType;
  const dataOid = forge.pki.oids.data;
  const messageDigest = forge.pki.oids.messageDigest;
  const signingTime = forge.pki.oids.signingTime;

  if (!sha1 || !contentType || !dataOid || !messageDigest || !signingTime) {
    throw cmsError("No se pudo preparar la firma SHA1 del TRA.");
  }

  const certificate = parseCertificate(input.certificatePem);
  const privateKey = parsePrivateKey(input.privateKeyPem);

  if (!privateKeyMatchesCertificate(certificate, privateKey)) {
    throw cmsError("La clave privada no corresponde al certificado.");
  }

  try {
    const signedData = forge.pkcs7.createSignedData();
    signedData.content = forge.util.createBuffer(input.traXml, "utf8");
    signedData.addCertificate(certificate);
    signedData.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: sha1,
      authenticatedAttributes: [
        {
          type: contentType,
          value: dataOid,
        },
        {
          type: messageDigest,
        },
        {
          type: signingTime,
          value: new Date().toISOString(),
        },
      ],
    });
    signedData.sign({ detached: false });

    const der = forge.asn1.toDer(signedData.toAsn1()).getBytes();
    const cmsBase64 = forge.util.encode64(der).replace(/\s+/g, "");

    if (
      cmsBase64.includes("BEGIN CMS") ||
      cmsBase64.includes("BEGIN PKCS7") ||
      cmsBase64.includes("PRIVATE KEY")
    ) {
      throw cmsError("El CMS firmado no tiene el formato DER esperado.");
    }

    return cmsBase64;
  } catch (error) {
    if (error instanceof ArcaWsaaError) {
      throw error;
    }

    throw cmsError("No se pudo firmar el TRA.");
  }
}
