import "server-only";
import { getArcaCertificate } from "@/server/arca/config/credentials";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { fingerprintArcaCertificate } from "@/server/arca/tickets/certificate-fingerprint";
import {
  ARCA_TICKET_ENCRYPTION_VERSION,
  decryptArcaTicket,
  encryptArcaTicket,
  readTicketEncryptionKey,
} from "@/server/arca/tickets/ticket-encryption";
import { isArcaTicketReusable } from "@/server/arca/tickets/ticket-validity";
import {
  arcaTicketContext,
  type ArcaTicketIdentity,
  type ArcaTicketLock,
  type ArcaTicketStore,
  type PersistedArcaTicket,
} from "@/server/arca/tickets/ticket.types";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";

type TicketRequest = (environment: ArcaEnvironment) => Promise<ArcaAccessTicket>;

export type GetValidArcaAccessTicketOptions = {
  now?: Date;
  requestTicket?: TicketRequest;
  store?: ArcaTicketStore;
  lock?: ArcaTicketLock;
  readCertificate?: (environment: ArcaEnvironment) => string;
  encryptionKey?: Buffer;
};

type CacheRead =
  | { status: "hit"; ticket: ArcaAccessTicket }
  | { status: "miss" }
  | { status: "corrupt" }
  | { status: "unsupported" };

function unsupportedVersion(): ArcaTicketCacheError {
  return new ArcaTicketCacheError(
    "La versión de cifrado del Ticket guardado no está soportada.",
    "ENCRYPTION_VERSION_UNSUPPORTED",
  );
}

function corruptCache(): ArcaTicketCacheError {
  return new ArcaTicketCacheError(
    "No se pudo leer el Ticket de Acceso guardado.",
    "ARCA_TICKET_CACHE_CORRUPT",
  );
}

function alreadyActive(): ArcaTicketCacheError {
  return new ArcaTicketCacheError(
    "ARCA informa un Ticket de Acceso vigente que esta instancia no tiene guardado.",
    "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED",
  );
}

function readCachedTicket(input: {
  row: PersistedArcaTicket | null;
  identity: ArcaTicketIdentity;
  key: Buffer;
  now: Date;
}): CacheRead {
  if (!input.row) {
    return { status: "miss" };
  }

  if (input.row.encryptionVersion !== ARCA_TICKET_ENCRYPTION_VERSION) {
    return { status: "unsupported" };
  }

  if (!isArcaTicketReusable(input.row.expirationTime, input.now)) {
    return { status: "miss" };
  }

  try {
    const secrets = decryptArcaTicket({
      encryptedPayload: input.row.encryptedPayload,
      iv: input.row.iv,
      authTag: input.row.authTag,
      aad: arcaTicketContext(input.identity),
      key: input.key,
    });

    return {
      status: "hit",
      ticket: {
        token: secrets.token,
        sign: secrets.sign,
        generationTime: input.row.generationTime,
        expirationTime: input.row.expirationTime,
        service: input.row.service,
        environment: input.identity.environment,
      },
    };
  } catch {
    return { status: "corrupt" };
  }
}

function assertReusableRead(read: CacheRead): ArcaAccessTicket | null {
  if (read.status === "hit") {
    return read.ticket;
  }

  if (read.status === "corrupt") {
    throw corruptCache();
  }

  if (read.status === "unsupported") {
    throw unsupportedVersion();
  }

  return null;
}

async function defaultStore(): Promise<ArcaTicketStore> {
  const { arcaAccessTicketRepository } = await import(
    "@/server/repositories/arca-access-ticket.repository"
  );
  return arcaAccessTicketRepository;
}

async function defaultLock(): Promise<ArcaTicketLock> {
  const { withArcaTicketLock } = await import("@/server/arca/tickets/ticket-lock");
  return (identity, task) => withArcaTicketLock(arcaTicketContext(identity), task);
}

function isAlreadyAuthenticated(error: unknown): boolean {
  return (
    error instanceof ArcaWsaaError &&
    error.code === "SOAP_FAULT" &&
    (error.faultCode?.includes("coe.alreadyAuthenticated") ?? false)
  );
}

/**
 * Devuelve un Ticket WSAA vigente para el ambiente.
 * Reutiliza el guardado si falta más de 5 minutos para que venza.
 * MODO_PRUEBA no toca la base ni WSAA.
 */
export async function getValidArcaAccessTicket(
  environment: ArcaEnvironment | "MODO_PRUEBA",
  options: GetValidArcaAccessTicketOptions = {},
): Promise<ArcaAccessTicket> {
  if (environment === "MODO_PRUEBA") {
    throw new ArcaConfigurationError(
      "El modo prueba interno no se conecta con ARCA.",
      "AMBIENTE_NO_SOPORTADO",
    );
  }

  const now = options.now ?? new Date();
  const readCertificate = options.readCertificate ?? getArcaCertificate;
  const requestTicket = options.requestTicket ?? requestWsaaTicket;
  const key = options.encryptionKey ?? readTicketEncryptionKey();
  const store = options.store ?? (await defaultStore());
  const lock = options.lock ?? (await defaultLock());
  const certificatePem = readCertificate(environment);
  const identity: ArcaTicketIdentity = {
    environment,
    service: resolveArcaEndpoints(environment).service,
    certificateFingerprint: fingerprintArcaCertificate(certificatePem),
  };

  const cached = assertReusableRead(
    readCachedTicket({
      row: await store.findTicket(identity),
      identity,
      key,
      now,
    }),
  );

  if (cached) {
    return cached;
  }

  return lock(identity, async (db) => {
    const current = assertReusableRead(
      readCachedTicket({
        row: await store.findTicket(identity, db),
        identity,
        key,
        now,
      }),
    );

    if (current) {
      return current;
    }

    let issued: ArcaAccessTicket;

    try {
      issued = await requestTicket(environment);
    } catch (error) {
      if (isAlreadyAuthenticated(error)) {
        throw alreadyActive();
      }

      throw error;
    }

    const encrypted = encryptArcaTicket({
      token: issued.token,
      sign: issued.sign,
      aad: arcaTicketContext(identity),
      key,
    });

    await store.upsertTicket(
      {
        ...identity,
        ...encrypted,
        generationTime: issued.generationTime,
        expirationTime: issued.expirationTime,
      },
      db,
    );

    return {
      token: issued.token,
      sign: issued.sign,
      generationTime: issued.generationTime,
      expirationTime: issued.expirationTime,
      service: identity.service,
      environment,
    };
  });
}
