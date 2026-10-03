import "server-only";
import { createHash, X509Certificate } from "node:crypto";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";

/** SHA-256 del certificado DER. No persiste el PEM. */
export function fingerprintArcaCertificate(certificatePem: string): string {
  try {
    const certificate = new X509Certificate(certificatePem);
    return createHash("sha256").update(certificate.raw).digest("hex");
  } catch {
    throw new ArcaConfigurationError(
      "El certificado no se pudo leer para identificar el ticket.",
      "CERTIFICADO_INVALIDO",
    );
  }
}
