import { randomBytes } from "node:crypto";
import forge from "node-forge";
import { describe, expect, it, vi } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import {
  getValidArcaAccessTicket,
  type GetValidArcaAccessTicketOptions,
} from "@/server/arca/tickets/access-ticket";
import { fingerprintArcaCertificate } from "@/server/arca/tickets/certificate-fingerprint";
import { encryptArcaTicket } from "@/server/arca/tickets/ticket-encryption";
import {
  arcaTicketContext,
  type ArcaTicketIdentity,
  type ArcaTicketLock,
  type ArcaTicketStore,
  type PersistedArcaTicket,
} from "@/server/arca/tickets/ticket.types";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { getTestCredentialPair } from "./wsaa-fixtures";

const NOW = new Date("2026-09-30T12:00:00.000Z");
const KEY = randomBytes(32);
const HOMO_CERT = getTestCredentialPair().certificatePem;

function identityFor(pem: string, environment: "HOMOLOGACION" | "PRODUCCION" = "HOMOLOGACION"): ArcaTicketIdentity {
  return {
    environment,
    service: "wsfe",
    certificateFingerprint: fingerprintArcaCertificate(pem),
  };
}

function issuedTicket(overrides?: Partial<ArcaAccessTicket>): ArcaAccessTicket {
  return {
    token: "token-emitido",
    sign: "sign-emitido",
    generationTime: new Date("2026-09-30T11:00:00.000Z"),
    expirationTime: new Date("2026-09-30T23:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
    ...overrides,
  };
}

function memoryStore(seed: PersistedArcaTicket[] = []): ArcaTicketStore & {
  rows: Map<string, PersistedArcaTicket>;
} {
  const rows = new Map(seed.map((row) => [arcaTicketContext(row), row]));
  return {
    rows,
    async findTicket(identity) {
      return rows.get(arcaTicketContext(identity)) ?? null;
    },
    async upsertTicket(ticket) {
      rows.set(arcaTicketContext(ticket), ticket);
    },
    async deleteTicket(identity) {
      rows.delete(arcaTicketContext(identity));
    },
  };
}

function serialLock(): ArcaTicketLock {
  const tails = new Map<string, Promise<unknown>>();
  return async (identity, task) => {
    const key = arcaTicketContext(identity);
    const previous = tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    tails.set(key, previous.then(() => gate));
    await previous;
    try {
      return await task(undefined);
    } finally {
      release();
    }
  };
}

function persistedFrom(ticket: ArcaAccessTicket, pem = HOMO_CERT): PersistedArcaTicket {
  const identity = identityFor(pem, ticket.environment);
  const encrypted = encryptArcaTicket({
    token: ticket.token,
    sign: ticket.sign,
    aad: arcaTicketContext(identity),
    key: KEY,
  });
  return {
    ...identity,
    ...encrypted,
    generationTime: ticket.generationTime,
    expirationTime: ticket.expirationTime,
  };
}

function options(overrides?: {
  store?: ArcaTicketStore;
  requestTicket?: unknown;
  lock?: ArcaTicketLock;
  certificatePem?: string;
  now?: Date;
}): GetValidArcaAccessTicketOptions {
  return {
    now: overrides?.now ?? NOW,
    encryptionKey: KEY,
    store: overrides?.store ?? memoryStore(),
    lock: overrides?.lock ?? serialLock(),
    readCertificate: () => overrides?.certificatePem ?? HOMO_CERT,
    requestTicket: (overrides?.requestTicket ??
      vi.fn()) as GetValidArcaAccessTicketOptions["requestTicket"],
  };
}

describe("getValidArcaAccessTicket", () => {
  it("reutiliza un ticket válido sin llamar a WSAA", async () => {
    const ticket = issuedTicket();
    const store = memoryStore([persistedFrom(ticket)]);
    const requestTicket = vi.fn();
    let locked = false;
    const lock: ArcaTicketLock = async () => {
      locked = true;
      throw new Error("No debía tomar el lock.");
    };

    const result = await getValidArcaAccessTicket(
      "HOMOLOGACION",
      options({ store, requestTicket, lock }),
    );

    expect(result.token).toBe(ticket.token);
    expect(result.sign).toBe(ticket.sign);
    expect(result.environment).toBe("HOMOLOGACION");
    expect(result.service).toBe("wsfe");
    expect(requestTicket).not.toHaveBeenCalled();
    expect(locked).toBe(false);
  });

  it("hace hit si vence en más de 5 minutos", async () => {
    const ticket = issuedTicket({
      expirationTime: new Date(NOW.getTime() + 5 * 60 * 1000 + 1),
    });
    const requestTicket = vi.fn();

    const result = await getValidArcaAccessTicket(
      "HOMOLOGACION",
      options({
        store: memoryStore([persistedFrom(ticket)]),
        requestTicket,
      }),
    );

    expect(result.expirationTime).toEqual(ticket.expirationTime);
    expect(requestTicket).not.toHaveBeenCalled();
  });

  it("renueva si vence dentro del margen de 5 minutos", async () => {
    const stale = issuedTicket({
      token: "token-viejo",
      expirationTime: new Date(NOW.getTime() + 4 * 60 * 1000),
    });
    const fresh = issuedTicket({ token: "token-nuevo", sign: "sign-nuevo" });
    const store = memoryStore([persistedFrom(stale)]);
    const requestTicket = vi.fn(async () => fresh);

    const result = await getValidArcaAccessTicket(
      "HOMOLOGACION",
      options({ store, requestTicket }),
    );

    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(result.token).toBe("token-nuevo");
    const saved = store.rows.get(arcaTicketContext(identityFor(HOMO_CERT)));
    expect(JSON.stringify(saved)).not.toContain("token-nuevo");
    expect(JSON.stringify(saved)).not.toContain("sign-nuevo");
  });

  it("pide WSAA una vez si no hay ticket y persiste el cifrado", async () => {
    const fresh = issuedTicket();
    const store = memoryStore();
    const requestTicket = vi.fn(async () => fresh);

    const result = await getValidArcaAccessTicket(
      "HOMOLOGACION",
      options({ store, requestTicket }),
    );

    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(result.token).toBe(fresh.token);
    expect(store.rows.size).toBe(1);
    const saved = [...store.rows.values()][0]!;
    expect(saved.encryptedPayload).not.toContain(fresh.token);
    expect(saved.authTag.length).toBeGreaterThan(0);
    expect(saved.encryptionVersion).toBe(1);
  });

  it("rechaza MODO_PRUEBA antes de la base y de WSAA", async () => {
    const store = memoryStore();
    const findTicket = vi.spyOn(store, "findTicket");
    const requestTicket = vi.fn();

    await expect(
      getValidArcaAccessTicket("MODO_PRUEBA", options({ store, requestTicket })),
    ).rejects.toBeInstanceOf(ArcaConfigurationError);
    await expect(
      getValidArcaAccessTicket("MODO_PRUEBA", options({ store, requestTicket })),
    ).rejects.toMatchObject({ code: "AMBIENTE_NO_SOPORTADO" });
    expect(findTicket).not.toHaveBeenCalled();
    expect(requestTicket).not.toHaveBeenCalled();
  });

  it("no reutiliza el ticket de otro certificado o ambiente", async () => {
    const homo = issuedTicket();
    const store = memoryStore([persistedFrom(homo)]);
    const otherPem = anotherCertificatePem();
    const homoIdentity = identityFor(HOMO_CERT, "HOMOLOGACION");
    const prodIdentity = identityFor(otherPem, "PRODUCCION");
    const homoKey = arcaTicketContext(homoIdentity);
    const savedHomo = store.rows.get(homoKey);
    const readCertificate = vi.fn(
      (environment: "HOMOLOGACION" | "PRODUCCION") =>
        environment === "PRODUCCION" ? otherPem : HOMO_CERT,
    );
    const requestTicket = vi.fn(async () =>
      issuedTicket({
        environment: "PRODUCCION",
        token: "token-produccion",
        sign: "sign-produccion",
      }),
    );

    const result = await getValidArcaAccessTicket("PRODUCCION", {
      ...options({ store, requestTicket }),
      readCertificate,
    });

    expect(prodIdentity.certificateFingerprint).not.toBe(
      homoIdentity.certificateFingerprint,
    );
    expect(readCertificate).toHaveBeenCalledWith("PRODUCCION");
    expect(readCertificate).not.toHaveBeenCalledWith("HOMOLOGACION");
    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(requestTicket).toHaveBeenCalledWith("PRODUCCION");
    expect(result.environment).toBe("PRODUCCION");
    expect(result.service).toBe("wsfe");
    expect(result.token).toBe("token-produccion");
    expect(store.rows.get(homoKey)).toBe(savedHomo);
    expect(store.rows.get(arcaTicketContext(prodIdentity))).toBeDefined();
    expect(store.rows.size).toBe(2);
  });

  it("falla de forma segura si el payload no se puede descifrar", async () => {
    const ticket = issuedTicket({ token: "token-secreto-cache" });
    const row = persistedFrom(ticket);
    row.authTag = Buffer.from("auth-tag-roto").toString("base64");
    const store = memoryStore([row]);
    const requestTicket = vi.fn();

    const error = await getValidArcaAccessTicket(
      "HOMOLOGACION",
      options({ store, requestTicket }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArcaTicketCacheError);
    expect(error).toMatchObject({ code: "ARCA_TICKET_CACHE_CORRUPT" });
    expect((error as Error).message).not.toContain("token-secreto-cache");
    expect((error as Error).message).not.toContain(row.encryptedPayload);
    expect(requestTicket).not.toHaveBeenCalled();
  });

  it("traduce coe.alreadyAuthenticated sin reintentar", async () => {
    const requestTicket = vi.fn(async () => {
      throw new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
        faultCode: "ns1:coe.alreadyAuthenticated",
        faultString: "Ya existe un TA valido",
      });
    });

    await expect(
      getValidArcaAccessTicket("HOMOLOGACION", options({ requestTicket })),
    ).rejects.toMatchObject({
      code: "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED",
    });
    expect(requestTicket).toHaveBeenCalledTimes(1);
  });

  it("pide el login una sola vez si dos llamadas coinciden", async () => {
    const store = memoryStore();
    const requestTicket = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return issuedTicket({ token: "token-unico", sign: "sign-unico" });
    });
    const shared = options({ store, requestTicket, lock: serialLock() });

    const [first, second] = await Promise.all([
      getValidArcaAccessTicket("HOMOLOGACION", shared),
      getValidArcaAccessTicket("HOMOLOGACION", shared),
    ]);

    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(first.token).toBe("token-unico");
    expect(second.token).toBe(first.token);
    expect(store.rows.size).toBe(1);
  });
});

function anotherCertificatePem(): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "03";
  certificate.validity.notBefore = new Date("2026-02-01T00:00:00.000Z");
  certificate.validity.notAfter = new Date("2027-02-01T00:00:00.000Z");
  const attributes = [{ name: "commonName", value: "cache-other.local" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(certificate);
}
