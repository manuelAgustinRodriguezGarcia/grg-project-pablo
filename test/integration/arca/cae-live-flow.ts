import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import {
  ArcaWsfeError,
  type ArcaWsfeErrorCode,
} from "@/server/arca/errors/arca-wsfe.error";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import type { ArcaCaeAuthorization, ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import { resolveLiveIssuerCuit } from "./wsfe-live-issuer";

export const ARCA_CAE_LIVE_PRECONDITION_FAILED = "ARCA_CAE_LIVE_PRECONDITION_FAILED";
export const EXPECTED_LAST_AUTHORIZED = 1;
export const HOMOLOGATION_VOUCHER_NUMBER = 2;
export const EXPECTED_POINT_OF_SALE = 7;
export const FACTURA_B_VOUCHER_TYPE = 6;
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * requestCae recibe importes fiscales en pesos, no en centavos.
 * 1000 se serializa como 1000.00. Pasar 100000 emitiría 100000.00.
 */
export const HOMOLOGATION_NET_AMOUNT = 1000;
export const HOMOLOGATION_VAT_AMOUNT = 210;
export const HOMOLOGATION_TOTAL_AMOUNT = 1210;

type FiscalSettings = {
  issuerCuit: string | null;
  pointOfSale: string | null;
} | null;

type LastAuthorizedQuery = {
  environment: "HOMOLOGACION";
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  pointOfSale: number;
  voucherType: number;
};

export type CaeLiveDependencies = {
  getLastAuthorizedVoucher: (
    input: LastAuthorizedQuery,
  ) => Promise<{ lastNumber: number }>;
  requestCae: (input: ArcaCaeRequest) => Promise<ArcaCaeAuthorization>;
};

type RemoteNote = {
  code: string;
  message: string;
};

export type CaeLiveOutcome =
  | { kind: "precondition_failed"; actualLastAuthorized: number }
  | { kind: "consultation_failed"; code: string }
  | {
      kind: "approved";
      caePresent: true;
      caeExpirationDate: string;
      observationCount: number;
    }
  | {
      kind: "rejected";
      observations: RemoteNote[];
      errors: RemoteNote[];
      events: RemoteNote[];
    }
  | { kind: "verification_failed"; actualLastAuthorized: number | null }
  | { kind: "ambiguous"; code: string };

export function formatArgentinaVoucherDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (
    !year ||
    !month ||
    !day ||
    !/^\d{4}$/.test(year) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{2}$/.test(day)
  ) {
    throw new Error("No se pudo calcular la fecha del comprobante en Argentina.");
  }

  return `${year}${month}${day}`;
}

export function resolveLiveFiscalContext(settings: FiscalSettings): {
  issuerCuit: string;
  pointOfSale: number;
} {
  const issuerCuit = resolveLiveIssuerCuit(settings);
  const storedPointOfSale = settings?.pointOfSale?.trim() ?? "";
  let pointOfSale: number;

  try {
    pointOfSale = parseArcaPointOfSale(storedPointOfSale);
  } catch {
    throw new Error(
      [
        ARCA_CAE_LIVE_PRECONDITION_FAILED,
        `expectedPointOfSale: ${EXPECTED_POINT_OF_SALE}`,
        "actualPointOfSale: invalid",
        "No se emitió ningún comprobante.",
      ].join("\n"),
    );
  }

  if (pointOfSale !== EXPECTED_POINT_OF_SALE) {
    throw new Error(
      [
        ARCA_CAE_LIVE_PRECONDITION_FAILED,
        `expectedPointOfSale: ${EXPECTED_POINT_OF_SALE}`,
        `actualPointOfSale: ${pointOfSale}`,
        "No se emitió ningún comprobante.",
      ].join("\n"),
    );
  }

  return { issuerCuit, pointOfSale };
}

export function buildHomologationCaeRequest(input: {
  issuerCuit: string;
  accessTicket: ArcaAccessTicket;
  voucherDate: string;
}): ArcaCaeRequest {
  return {
    environment: "HOMOLOGACION",
    accessTicket: input.accessTicket,
    issuerCuit: input.issuerCuit,
    pointOfSale: EXPECTED_POINT_OF_SALE,
    voucherType: FACTURA_B_VOUCHER_TYPE,
    concept: 1,
    documentType: 99,
    documentNumber: 0,
    voucherFrom: HOMOLOGATION_VOUCHER_NUMBER,
    voucherTo: HOMOLOGATION_VOUCHER_NUMBER,
    voucherDate: input.voucherDate,
    totalAmount: HOMOLOGATION_TOTAL_AMOUNT,
    nonTaxedAmount: 0,
    netAmount: HOMOLOGATION_NET_AMOUNT,
    exemptAmount: 0,
    taxAmount: 0,
    vatAmount: HOMOLOGATION_VAT_AMOUNT,
    currencyId: "PES",
    currencyRate: 1,
    receiverVatConditionId: 5,
    vatBreakdown: [
      {
        id: 5,
        baseAmount: HOMOLOGATION_NET_AMOUNT,
        amount: HOMOLOGATION_VAT_AMOUNT,
      },
    ],
  };
}

function domainCode(error: unknown): string {
  if (error instanceof ArcaWsfeError) {
    return wsfeCode(error.code);
  }

  if (
    error instanceof ArcaConfigurationError ||
    error instanceof ArcaTicketCacheError ||
    error instanceof ArcaWsaaError
  ) {
    return error.code;
  }

  return "UNEXPECTED";
}

function wsfeCode(code: ArcaWsfeErrorCode): ArcaWsfeErrorCode {
  switch (code) {
    case "NETWORK_ERROR":
    case "HTTP_ERROR":
    case "SOAP_FAULT":
    case "ARCA_ERROR":
    case "INVALID_RESPONSE":
    case "INVALID_TICKET":
    case "TICKET_EXPIRED":
    case "INVALID_ENVIRONMENT":
    case "INVALID_CAE_REQUEST":
    case "INVALID_VOUCHER_QUERY":
    case "VOUCHER_NOT_FOUND":
      return code;
    default: {
      const unexpected: never = code;
      return unexpected;
    }
  }
}

function lastAuthorizedQuery(
  issuerCuit: string,
  accessTicket: ArcaAccessTicket,
): LastAuthorizedQuery {
  return {
    environment: "HOMOLOGACION",
    accessTicket,
    issuerCuit,
    pointOfSale: EXPECTED_POINT_OF_SALE,
    voucherType: FACTURA_B_VOUCHER_TYPE,
  };
}

function approvedEcho(authorization: ArcaCaeAuthorization): boolean {
  return (
    authorization.status === "approved" &&
    authorization.header.pointOfSale === EXPECTED_POINT_OF_SALE &&
    authorization.header.voucherType === FACTURA_B_VOUCHER_TYPE &&
    authorization.detail.voucherFrom === HOMOLOGATION_VOUCHER_NUMBER &&
    authorization.detail.voucherTo === HOMOLOGATION_VOUCHER_NUMBER &&
    authorization.cae.length > 0 &&
    authorization.caeExpirationDate.length > 0
  );
}

export async function runHomologationCaeLive(input: {
  issuerCuit: string;
  accessTicket: ArcaAccessTicket;
  now: Date;
  dependencies: CaeLiveDependencies;
}): Promise<CaeLiveOutcome> {
  const query = lastAuthorizedQuery(input.issuerCuit, input.accessTicket);
  let lastNumber: number;

  try {
    const before = await input.dependencies.getLastAuthorizedVoucher(query);
    lastNumber = before.lastNumber;
  } catch (error) {
    return { kind: "consultation_failed", code: domainCode(error) };
  }

  if (lastNumber !== EXPECTED_LAST_AUTHORIZED) {
    return { kind: "precondition_failed", actualLastAuthorized: lastNumber };
  }

  let authorization: ArcaCaeAuthorization;

  try {
    authorization = await input.dependencies.requestCae(
      buildHomologationCaeRequest({
        issuerCuit: input.issuerCuit,
        accessTicket: input.accessTicket,
        voucherDate: formatArgentinaVoucherDate(input.now),
      }),
    );
  } catch (error) {
    // Timeout, red, HTTP, XML inválido o SOAP Fault pueden dejar el comprobante
    // en un estado desconocido. No se reintenta FECAESolicitar. Hay que
    // verificarlo por consulta antes de cualquier nuevo intento.
    return { kind: "ambiguous", code: domainCode(error) };
  }

  switch (authorization.status) {
    case "rejected":
      return {
        kind: "rejected",
        observations: authorization.observations,
        errors: authorization.errors,
        events: authorization.events,
      };
    case "approved":
      break;
    default: {
      const unexpected: never = authorization;
      return unexpected;
    }
  }

  if (!approvedEcho(authorization)) {
    return { kind: "ambiguous", code: "INVALID_RESPONSE" };
  }

  const caeExpirationDate = authorization.caeExpirationDate;
  const observationCount = authorization.observations.length;

  try {
    const after = await input.dependencies.getLastAuthorizedVoucher(query);

    if (after.lastNumber !== HOMOLOGATION_VOUCHER_NUMBER) {
      return {
        kind: "verification_failed",
        actualLastAuthorized: after.lastNumber,
      };
    }
  } catch {
    return { kind: "verification_failed", actualLastAuthorized: null };
  }

  return {
    kind: "approved",
    caePresent: true,
    caeExpirationDate,
    observationCount,
  };
}

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
    .replace(/\d{14}/g, "[redacted]")
    .slice(0, 300);
}

function formatNotes(label: string, notes: RemoteNote[]): string[] {
  if (notes.length === 0) {
    return [`${label}: 0`];
  }

  return notes.map(
    (note) =>
      `${label}: ${sanitizeDiagnostic(note.code)} ${sanitizeDiagnostic(note.message)}`,
  );
}

export function formatCaeLiveReport(outcome: CaeLiveOutcome): string {
  switch (outcome.kind) {
    case "precondition_failed":
      return [
        ARCA_CAE_LIVE_PRECONDITION_FAILED,
        `expectedLastAuthorized: ${EXPECTED_LAST_AUTHORIZED}`,
        `actualLastAuthorized: ${outcome.actualLastAuthorized}`,
        "No se emitió ningún comprobante.",
      ].join("\n");
    case "consultation_failed":
      return [
        ARCA_CAE_LIVE_PRECONDITION_FAILED,
        `code: ${outcome.code}`,
        "No se emitió ningún comprobante.",
      ].join("\n");
    case "approved":
      return [
        "ARCA CAE HOMOLOGACION OK",
        `pointOfSale: ${EXPECTED_POINT_OF_SALE}`,
        `voucherType: ${FACTURA_B_VOUCHER_TYPE}`,
        `voucherNumber: ${HOMOLOGATION_VOUCHER_NUMBER}`,
        "result: APPROVED",
        "caePresent: true",
        `caeExpirationDate: ${outcome.caeExpirationDate}`,
        `observations: ${outcome.observationCount}`,
      ].join("\n");
    case "rejected":
      return [
        "ARCA CAE HOMOLOGACION REJECTED",
        `pointOfSale: ${EXPECTED_POINT_OF_SALE}`,
        `voucherType: ${FACTURA_B_VOUCHER_TYPE}`,
        `voucherNumber: ${HOMOLOGATION_VOUCHER_NUMBER}`,
        ...formatNotes("observation", outcome.observations),
        ...formatNotes("error", outcome.errors),
        ...formatNotes("event", outcome.events),
        "No se reintentó.",
      ].join("\n");
    case "verification_failed":
      return [
        "CAE fue aprobado pero falló la verificación posterior.",
        "No se reintentó FECAESolicitar.",
        `actualLastAuthorized: ${outcome.actualLastAuthorized ?? "unavailable"}`,
      ].join("\n");
    case "ambiguous":
      return [
        "ARCA CAE HOMOLOGACION AMBIGUOUS",
        `code: ${outcome.code}`,
        "No se reintentó FECAESolicitar.",
        "El estado debe verificarse mediante consulta antes de cualquier nuevo intento.",
      ].join("\n");
    default: {
      const unexpected: never = outcome;
      return unexpected;
    }
  }
}
