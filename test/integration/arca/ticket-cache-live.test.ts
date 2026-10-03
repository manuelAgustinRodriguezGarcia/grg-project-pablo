import { describe, expect, it } from "vitest";
import { getArcaCertificate } from "@/server/arca/config/credentials";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { fingerprintArcaCertificate } from "@/server/arca/tickets/certificate-fingerprint";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { ARCA_TICKET_ENCRYPTION_KEY_ENV } from "@/server/arca/tickets/ticket-encryption";
import { isArcaTicketReusable } from "@/server/arca/tickets/ticket-validity";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { loadNextLocalEnv } from "./load-next-env";

const LIVE_ENABLED = process.env.ARCA_TICKET_CACHE_LIVE_TEST === "1";

const REQUIRED_ENV = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  ARCA_TICKET_ENCRYPTION_KEY_ENV,
  "DATABASE_URL",
] as const;

type CachedTicketRow = {
  encryptedPayload: string;
  iv: string;
  authTag: string;
  expirationTime: Date;
  updatedAt: Date;
};

function missingCredentialNames(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

function isAssertionError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AssertionError";
}

function formatSafeFailure(error: unknown): string {
  if (error instanceof ArcaTicketCacheError) {
    const lines = ["ARCA TICKET CACHE HOMOLOGACION ERROR", `code: ${error.code}`];

    if (error.code === "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED") {
      lines.push(
        "ARCA todavía tiene un Ticket vigente que no está en nuestro cache.",
        "No se reintentó.",
      );
    }

    return lines.join("\n");
  }

  if (error instanceof ArcaWsaaError) {
    const faultCode = error.faultCode?.includes("coe.alreadyAuthenticated")
      ? "coe.alreadyAuthenticated"
      : (error.faultCode ?? "");
    const lines = [
      "ARCA TICKET CACHE HOMOLOGACION ERROR",
      `code: ${error.code}`,
      `faultCode: ${faultCode}`,
    ];

    if (faultCode === "coe.alreadyAuthenticated") {
      lines.push(
        "ARCA todavía tiene un Ticket vigente que no está en nuestro cache.",
        "No se reintentó.",
      );
    }

    return lines.join("\n");
  }

  if (
    error instanceof Error &&
    error.message.startsWith("ARCA TICKET CACHE HOMOLOGACION")
  ) {
    return error.message;
  }

  return [
    "ARCA TICKET CACHE HOMOLOGACION ERROR",
    "code: UNEXPECTED",
    "message: La prueba live falló sin un error de dominio interpretable.",
  ].join("\n");
}

function sameTicket(first: ArcaAccessTicket, second: ArcaAccessTicket): boolean {
  return (
    first.token === second.token &&
    first.sign === second.sign &&
    first.generationTime.getTime() === second.generationTime.getTime() &&
    first.expirationTime.getTime() === second.expirationTime.getTime()
  );
}

function persistedLooksEncrypted(row: CachedTicketRow, ticket: ArcaAccessTicket): boolean {
  if (!row.encryptedPayload || !row.iv || !row.authTag) {
    return false;
  }

  const stored = `${row.encryptedPayload}\n${row.iv}\n${row.authTag}`;
  return !stored.includes(ticket.token) && !stored.includes(ticket.sign);
}

describe.skipIf(!LIVE_ENABLED)("cache live del Ticket WSAA", () => {
  it("obtiene el ticket una vez y lo reutiliza", async () => {
    loadNextLocalEnv();

    const missing = missingCredentialNames();
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables para la prueba live del cache: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
      );
    }

    const { prisma } = await import("@/server/database/prisma");
    const service = resolveArcaEndpoints("HOMOLOGACION").service;
    const certificateFingerprint = fingerprintArcaCertificate(
      getArcaCertificate("HOMOLOGACION"),
    );
    const where = {
      environment_service_certificateFingerprint: {
        environment: "HOMOLOGACION" as const,
        service,
        certificateFingerprint,
      },
    };

    const readRow = async (): Promise<CachedTicketRow | null> => {
      try {
        return await prisma.arcaAccessTicketCache.findUnique({
          where,
          select: {
            encryptedPayload: true,
            iv: true,
            authTag: true,
            expirationTime: true,
            updatedAt: true,
          },
        });
      } catch {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: CACHE_READ\nmessage: No se pudo leer el cache. No se reintentó.",
        );
      }
    };

    let wsaaCalls = 0;
    const requestTicket = async (environment: ArcaEnvironment) => {
      wsaaCalls += 1;
      if (wsaaCalls > 1) {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: SECOND_LOGIN\nmessage: Se intentó un segundo loginCms. No se reintentó.",
        );
      }

      return requestWsaaTicket(environment);
    };

    const ticketOptions = { requestTicket };

    try {
      const before = await readRow();
      const startedWithReusableTicket = Boolean(
        before && isArcaTicketReusable(before.expirationTime, new Date()),
      );

      const first = await getValidArcaAccessTicket("HOMOLOGACION", ticketOptions);
      const callsAfterFirst = wsaaCalls;
      const rowAfterFirst = await readRow();

      if (!rowAfterFirst || !persistedLooksEncrypted(rowAfterFirst, first)) {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: PLAINTEXT_OR_MISSING\nmessage: El ticket persistido no está cifrado o no existe.",
        );
      }

      if (rowAfterFirst.expirationTime.getTime() <= Date.now()) {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: EXPIRED_ROW\nmessage: La fila persistida no está vigente.",
        );
      }

      const payloadAfterFirst = rowAfterFirst.encryptedPayload;
      const updatedAtAfterFirst = rowAfterFirst.updatedAt.getTime();
      const second = await getValidArcaAccessTicket("HOMOLOGACION", ticketOptions);
      const rowAfterSecond = await readRow();

      if (
        !rowAfterSecond ||
        rowAfterSecond.encryptedPayload !== payloadAfterFirst ||
        rowAfterSecond.updatedAt.getTime() !== updatedAtAfterFirst ||
        !sameTicket(first, second)
      ) {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: NOT_REUSED\nmessage: La segunda llamada no reutilizó el mismo Ticket.",
        );
      }

      expect(first.environment).toBe("HOMOLOGACION");
      expect(first.service).toBe(service);
      expect(second.environment).toBe("HOMOLOGACION");
      expect(second.service).toBe(service);

      if (startedWithReusableTicket) {
        if (wsaaCalls !== 0) {
          throw new Error(
            "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: UNEXPECTED_LOGIN\nmessage: Había un Ticket vigente y aun así se llamó a WSAA.",
          );
        }

        console.log(
          [
            "ARCA TICKET CACHE HOMOLOGACION",
            "startedWith: HIT",
            "firstCall: HIT",
            "secondCall: HIT",
            "wsaaCalls: 0",
            `service: ${service}`,
            "environment: HOMOLOGACION",
            "sameTicketReused: true",
            `expirationTime: ${second.expirationTime.toISOString()}`,
            "Ya había un Ticket vigente. No se validó MISS → REFRESH. No se borró la fila.",
          ].join("\n"),
        );
        return;
      }

      if (callsAfterFirst !== 1 || wsaaCalls !== 1) {
        throw new Error(
          "ARCA TICKET CACHE HOMOLOGACION ERROR\ncode: WSAA_CALLS\nmessage: El loginCms no se ejecutó exactamente una vez.",
        );
      }

      console.log(
        [
          "ARCA TICKET CACHE HOMOLOGACION OK",
          "firstCall: REFRESH",
          "secondCall: HIT",
          `service: ${service}`,
          "environment: HOMOLOGACION",
          "persisted: true",
          "encrypted: true",
          "sameTicketReused: true",
          `expirationTime: ${second.expirationTime.toISOString()}`,
        ].join("\n"),
      );
    } catch (error) {
      if (isAssertionError(error)) {
        throw error;
      }

      const safe = formatSafeFailure(error);
      console.log(safe);
      throw new Error(safe);
    }
  });
});
