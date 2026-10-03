import "server-only";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import type {
  ArcaCredentials,
  ArcaEnvironment,
} from "@/server/arca/types/arca.types";

const CERT_ENV = {
  HOMOLOGACION: "ARCA_HOMO_CERT_B64",
  PRODUCCION: "ARCA_PROD_CERT_B64",
} as const satisfies Record<ArcaEnvironment, string>;

const PRIVATE_KEY_ENV = {
  HOMOLOGACION: "ARCA_HOMO_PRIVATE_KEY_B64",
  PRODUCCION: "ARCA_PROD_PRIVATE_KEY_B64",
} as const satisfies Record<ArcaEnvironment, string>;

function readRequiredEnv(
  envName: string,
  missingCode: "CERTIFICADO_AUSENTE" | "PRIVATE_KEY_AUSENTE",
): string {
  const value = process.env[envName]?.trim();

  if (!value) {
    throw new ArcaConfigurationError(
      `Falta la variable de entorno ${envName}.`,
      missingCode,
    );
  }

  return value;
}

function decodeBase64Pem(
  encoded: string,
  envName: string,
  pemMarker: "CERTIFICATE" | "PRIVATE KEY",
  invalidCode: "CERTIFICADO_INVALIDO" | "PRIVATE_KEY_INVALIDA",
): string {
  const decoded = Buffer.from(encoded, "base64").toString("utf8").trim();

  if (
    !decoded.includes("-----BEGIN ") ||
    !decoded.includes(pemMarker) ||
    !decoded.includes("-----END ")
  ) {
    throw new ArcaConfigurationError(
      `La variable ${envName} no contiene un PEM válido.`,
      invalidCode,
    );
  }

  return decoded;
}

export function getArcaCertificate(environment: ArcaEnvironment): string {
  const envName = CERT_ENV[environment];
  const encoded = readRequiredEnv(envName, "CERTIFICADO_AUSENTE");
  return decodeBase64Pem(
    encoded,
    envName,
    "CERTIFICATE",
    "CERTIFICADO_INVALIDO",
  );
}

export function getArcaPrivateKey(environment: ArcaEnvironment): string {
  const envName = PRIVATE_KEY_ENV[environment];
  const encoded = readRequiredEnv(envName, "PRIVATE_KEY_AUSENTE");
  return decodeBase64Pem(
    encoded,
    envName,
    "PRIVATE KEY",
    "PRIVATE_KEY_INVALIDA",
  );
}

export function getArcaCredentials(
  environment: ArcaEnvironment,
): ArcaCredentials {
  return {
    certificatePem: getArcaCertificate(environment),
    privateKeyPem: getArcaPrivateKey(environment),
  };
}
