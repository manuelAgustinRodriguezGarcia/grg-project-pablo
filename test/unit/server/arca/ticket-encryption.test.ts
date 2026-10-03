import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import {
  ARCA_TICKET_ENCRYPTION_KEY_ENV,
  decryptArcaTicket,
  encryptArcaTicket,
  readTicketEncryptionKey,
} from "@/server/arca/tickets/ticket-encryption";

const TOKEN = "token-plano-unico";
const SIGN = "sign-plano-unico";
const AAD = "HOMOLOGACION|wsfe|abc123";

function validKey(): Buffer {
  return randomBytes(32);
}

afterEach(() => {
  delete process.env[ARCA_TICKET_ENCRYPTION_KEY_ENV];
});

describe("readTicketEncryptionKey", () => {
  it("acepta 32 bytes en Base64", () => {
    const key = validKey();
    expect(readTicketEncryptionKey(key.toString("base64"))).toEqual(key);
  });

  it("falla si la clave no está", () => {
    expect(() => readTicketEncryptionKey(undefined)).toThrow(ArcaConfigurationError);
    expect(() => readTicketEncryptionKey("")).toThrowError(
      expect.objectContaining({ code: "CLAVE_CIFRADO_AUSENTE" }),
    );
  });

  it("falla si el tamaño no es de 32 bytes y no muestra la clave", () => {
    const encoded = randomBytes(16).toString("base64");

    expect(() => readTicketEncryptionKey(encoded)).toThrowError(
      expect.objectContaining({ code: "CLAVE_CIFRADO_INVALIDA" }),
    );

    try {
      readTicketEncryptionKey(encoded);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(encoded);
    }
  });
});

describe("encryptArcaTicket", () => {
  it("recupera token y sign, con IV distinto y sin texto plano", () => {
    const key = validKey();
    const first = encryptArcaTicket({ token: TOKEN, sign: SIGN, aad: AAD, key });
    const second = encryptArcaTicket({ token: TOKEN, sign: SIGN, aad: AAD, key });

    expect(decryptArcaTicket({ ...first, aad: AAD, key })).toEqual({
      token: TOKEN,
      sign: SIGN,
    });
    expect(first.iv).not.toBe(second.iv);
    expect(first.encryptionVersion).toBe(1);

    const persisted = JSON.stringify(first);
    expect(persisted).not.toContain(TOKEN);
    expect(persisted).not.toContain(SIGN);
    expect(Buffer.from(first.encryptedPayload, "base64").toString("utf8")).not.toContain(
      TOKEN,
    );
  });

  it("falla si se altera el authTag", () => {
    const key = validKey();
    const encrypted = encryptArcaTicket({ token: TOKEN, sign: SIGN, aad: AAD, key });
    const authTag = Buffer.from(encrypted.authTag, "base64");
    authTag[0] = authTag[0]! ^ 0xff;

    expect(() =>
      decryptArcaTicket({
        ...encrypted,
        authTag: authTag.toString("base64"),
        aad: AAD,
        key,
      }),
    ).toThrow(ArcaTicketCacheError);
  });

  it("falla si se altera el ciphertext", () => {
    const key = validKey();
    const encrypted = encryptArcaTicket({ token: TOKEN, sign: SIGN, aad: AAD, key });
    const payload = Buffer.from(encrypted.encryptedPayload, "base64");
    payload[0] = payload[0]! ^ 0xff;

    expect(() =>
      decryptArcaTicket({
        ...encrypted,
        encryptedPayload: payload.toString("base64"),
        aad: AAD,
        key,
      }),
    ).toThrowError(expect.objectContaining({ code: "ARCA_TICKET_CACHE_CORRUPT" }));
  });

  it("falla si el AAD no coincide", () => {
    const key = validKey();
    const encrypted = encryptArcaTicket({ token: TOKEN, sign: SIGN, aad: AAD, key });

    expect(() =>
      decryptArcaTicket({
        ...encrypted,
        aad: "PRODUCCION|wsfe|abc123",
        key,
      }),
    ).toThrowError(expect.objectContaining({ code: "ARCA_TICKET_CACHE_CORRUPT" }));
  });
});
