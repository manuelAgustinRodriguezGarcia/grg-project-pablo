import "server-only";
import { randomInt } from "node:crypto";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import type { LoginTicketRequest } from "@/server/arca/wsaa/wsaa.types";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const UINT32_MAX = 4_294_967_295;

export type UniqueIdGenerator = () => number;

function assertUniqueId(uniqueId: number): number {
  if (!Number.isInteger(uniqueId) || uniqueId <= 0 || uniqueId > UINT32_MAX) {
    throw new ArcaWsaaError(
      "El identificador del TRA está fuera del rango de 32 bits.",
      "TRA_INVALID",
    );
  }

  return uniqueId;
}

/** Entero aleatorio criptográfico en 1..4294967295. No depende del reloj. */
export function createRandomUniqueId(): number {
  return randomInt(1, UINT32_MAX + 1);
}

export function buildUniqueId(
  createUniqueId: UniqueIdGenerator = createRandomUniqueId,
): number {
  return assertUniqueId(createUniqueId());
}

/** xsd:dateTime en UTC, a partir de Date. Sin armar la fecha a mano. */
export function formatXsdDateTimeUtc(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new ArcaWsaaError("La fecha del TRA no es válida.", "TRA_INVALID");
  }

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Arma el LoginTicketRequest.
 * generationTime / expirationTime son la validez del pedido, no la del ticket.
 */
export function buildLoginTicketRequest(input: {
  service: string;
  now?: Date;
  uniqueId?: number;
  createUniqueId?: UniqueIdGenerator;
}): LoginTicketRequest {
  const service = input.service.trim();

  if (!service) {
    throw new ArcaWsaaError(
      "El servicio del TRA no está definido.",
      "TRA_INVALID",
    );
  }

  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    throw new ArcaWsaaError("La fecha del TRA no es válida.", "TRA_INVALID");
  }

  const generationTime = new Date(now.getTime() - TEN_MINUTES_MS);
  const expirationTime = new Date(now.getTime() + TEN_MINUTES_MS);
  const uniqueId =
    input.uniqueId === undefined
      ? buildUniqueId(input.createUniqueId)
      : assertUniqueId(input.uniqueId);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketRequest version="1.0">',
    "  <header>",
    `    <uniqueId>${uniqueId}</uniqueId>`,
    `    <generationTime>${formatXsdDateTimeUtc(generationTime)}</generationTime>`,
    `    <expirationTime>${formatXsdDateTimeUtc(expirationTime)}</expirationTime>`,
    "  </header>",
    `  <service>${escapeXml(service)}</service>`,
    "</loginTicketRequest>",
  ].join("\n");

  return {
    xml,
    uniqueId,
    generationTime,
    expirationTime,
  };
}
