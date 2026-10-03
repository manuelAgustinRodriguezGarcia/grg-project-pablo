import "server-only";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import type { ParsedWsfeResult } from "@/server/arca/wsfe/wsfe-response";
import { readWsfeCodedItems, requireWsfeInteger } from "@/server/arca/wsfe/wsfe-response";
import type { FeCaeRequestXml } from "@/server/arca/wsfe/wsfe-soap";
import type {
  ArcaCaeAuthorization,
  ArcaCaeDetail,
  ArcaCaeHeader,
  ArcaWsfeObservation,
} from "@/server/arca/wsfe/wsfe.types";

const CAE_PATTERN = /^\d{14}$/;
const PROCESS_DATE_PATTERN = /^\d{14}$/;
const VOUCHER_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

function invalidResponse(): ArcaWsfeError {
  return new ArcaWsfeError(
    "La respuesta de WSFEv1 no se pudo interpretar.",
    "INVALID_RESPONSE",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function readResultCode(value: unknown): "A" | "R" {
  const text = textOf(value);

  if (text === "A" || text === "R") {
    return text;
  }

  throw invalidResponse();
}

function readReprocess(value: unknown): "S" | "N" {
  const text = textOf(value);

  if (text === "S" || text === "N") {
    return text;
  }

  throw invalidResponse();
}

function readVoucherDate(value: unknown): string {
  const text = textOf(value);

  if (!text) {
    throw invalidResponse();
  }

  const match = VOUCHER_DATE_PATTERN.exec(text);

  if (!match) {
    throw invalidResponse();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!valid) {
    throw invalidResponse();
  }

  return text;
}

function readProcessDate(value: unknown): string {
  const text = textOf(value);

  if (!text || !PROCESS_DATE_PATTERN.test(text)) {
    throw invalidResponse();
  }

  return text;
}

function readObservations(
  detail: Record<string, unknown>,
  secrets: readonly string[],
): ArcaWsfeObservation[] {
  return readWsfeCodedItems(detail.Observaciones, "Obs", secrets);
}

function readDetail(
  result: Record<string, unknown>,
  secrets: readonly string[],
): { detail: ArcaCaeDetail; cae: string | null; caeExpirationDate: string | null } {
  const container = result.FeDetResp;

  if (!isRecord(container)) {
    throw invalidResponse();
  }

  const rawDetail = container.FECAEDetResponse;
  const detail = Array.isArray(rawDetail) ? null : rawDetail;

  if (!isRecord(detail)) {
    throw invalidResponse();
  }

  const caeText = textOf(detail.CAE);
  const expirationText = textOf(detail.CAEFchVto);

  return {
    detail: {
      concept: requireWsfeInteger(detail.Concepto, 1),
      documentType: requireWsfeInteger(detail.DocTipo, 0),
      documentNumber: requireWsfeInteger(detail.DocNro, 0),
      voucherFrom: requireWsfeInteger(detail.CbteDesde, 1),
      voucherTo: requireWsfeInteger(detail.CbteHasta, 1),
      voucherDate: readVoucherDate(detail.CbteFch),
      result: readResultCode(detail.Resultado),
      observations: readObservations(detail, secrets),
    },
    cae: caeText,
    caeExpirationDate: expirationText,
  };
}

function readHeader(result: Record<string, unknown>, issuerCuit: string): ArcaCaeHeader {
  const header = result.FeCabResp;

  if (!isRecord(header)) {
    throw invalidResponse();
  }

  let cuit: string;

  try {
    cuit = normalizeIssuerCuit(textOf(header.Cuit) ?? "");
  } catch {
    throw invalidResponse();
  }

  if (cuit !== issuerCuit) {
    throw invalidResponse();
  }

  return {
    cuit,
    pointOfSale: requireWsfeInteger(header.PtoVta, 1),
    voucherType: requireWsfeInteger(header.CbteTipo, 1),
    processDate: readProcessDate(header.FchProceso),
    recordCount: requireWsfeInteger(header.CantReg, 1),
    result: readResultCode(header.Resultado),
    reprocess: readReprocess(header.Reproceso),
  };
}

function assertEcho(
  header: ArcaCaeHeader,
  detail: ArcaCaeDetail,
  request: FeCaeRequestXml,
): void {
  const matches =
    header.pointOfSale === request.pointOfSale &&
    header.voucherType === request.voucherType &&
    header.recordCount === 1 &&
    detail.concept === request.concept &&
    detail.documentType === request.documentType &&
    detail.documentNumber === request.documentNumber &&
    detail.voucherFrom === request.voucherFrom &&
    detail.voucherTo === request.voucherTo &&
    detail.voucherDate === request.voucherDate &&
    detail.result === header.result;

  if (!matches) {
    throw invalidResponse();
  }
}

function arcaErrors(errors: ParsedWsfeResult["errors"]): ArcaWsfeError {
  return new ArcaWsfeError("WSFE rechazó la solicitud de CAE.", "ARCA_ERROR", {
    remoteErrors: errors,
  });
}

export function parseCaeAuthorization(input: {
  parsed: ParsedWsfeResult;
  request: FeCaeRequestXml;
  issuerCuit: string;
  secrets: readonly string[];
}): ArcaCaeAuthorization {
  if (!isRecord(input.parsed.result.FeCabResp)) {
    if (input.parsed.errors.length > 0) {
      throw arcaErrors(input.parsed.errors);
    }

    throw invalidResponse();
  }

  const header = readHeader(input.parsed.result, input.issuerCuit);
  const { detail, cae, caeExpirationDate } = readDetail(input.parsed.result, input.secrets);
  assertEcho(header, detail, input.request);

  const base = {
    header,
    detail,
    observations: detail.observations,
    errors: input.parsed.errors,
    events: input.parsed.events,
  };

  switch (header.result) {
    case "A": {
      if (!cae || !CAE_PATTERN.test(cae) || !caeExpirationDate) {
        throw invalidResponse();
      }

      return {
        ...base,
        status: "approved",
        result: "A",
        cae,
        caeExpirationDate: readVoucherDate(caeExpirationDate),
      };
    }
    case "R": {
      if (cae) {
        throw invalidResponse();
      }

      return {
        ...base,
        status: "rejected",
        result: "R",
        cae: null,
        caeExpirationDate: null,
      };
    }
    default: {
      const unexpected: never = header.result;
      throw unexpected;
    }
  }
}
