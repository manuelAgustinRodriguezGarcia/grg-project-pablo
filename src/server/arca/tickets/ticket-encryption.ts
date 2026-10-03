import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";

export const ARCA_TICKET_ENCRYPTION_VERSION = 1;
export const ARCA_TICKET_ENCRYPTION_KEY_ENV = "ARCA_TICKET_ENCRYPTION_KEY_B64";

const KEY_BYTES = 32;
const IV_BYTES = 12;

export type EncryptedArcaTicketPayload = {
  encryptedPayload: string;
  iv: string;
  authTag: string;
  encryptionVersion: number;
};

type TicketSecrets = {
  token: string;
  sign: string;
};

function invalidKey(): ArcaConfigurationError {
  return new ArcaConfigurationError(
    `La variable ${ARCA_TICKET_ENCRYPTION_KEY_ENV} no es válida.`,
    "CLAVE_CIFRADO_INVALIDA",
  );
}

export function readTicketEncryptionKey(
  encoded: string | undefined = process.env[ARCA_TICKET_ENCRYPTION_KEY_ENV],
): Buffer {
  const value = encoded?.trim() ?? "";

  if (!value) {
    throw new ArcaConfigurationError(
      `Falta la variable de entorno ${ARCA_TICKET_ENCRYPTION_KEY_ENV}.`,
      "CLAVE_CIFRADO_AUSENTE",
    );
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw invalidKey();
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== KEY_BYTES) {
    throw invalidKey();
  }

  return key;
}

export function encryptArcaTicket(input: {
  token: string;
  sign: string;
  aad: string;
  key: Buffer;
}): EncryptedArcaTicketPayload {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  cipher.setAAD(Buffer.from(input.aad, "utf8"));
  const plaintext = Buffer.from(
    JSON.stringify({ token: input.token, sign: input.sign } satisfies TicketSecrets),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    encryptedPayload: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    encryptionVersion: ARCA_TICKET_ENCRYPTION_VERSION,
  };
}

export function decryptArcaTicket(input: {
  encryptedPayload: string;
  iv: string;
  authTag: string;
  aad: string;
  key: Buffer;
}): TicketSecrets {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      input.key,
      Buffer.from(input.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(input.aad, "utf8"));
    decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(input.encryptedPayload, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(plaintext);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("token" in parsed) ||
      !("sign" in parsed) ||
      typeof parsed.token !== "string" ||
      typeof parsed.sign !== "string" ||
      parsed.token.length === 0 ||
      parsed.sign.length === 0
    ) {
      throw new Error("payload");
    }

    return { token: parsed.token, sign: parsed.sign };
  } catch (error) {
    if (error instanceof ArcaTicketCacheError) {
      throw error;
    }

    throw new ArcaTicketCacheError(
      "No se pudo leer el Ticket de Acceso guardado.",
      "ARCA_TICKET_CACHE_CORRUPT",
    );
  }
}
