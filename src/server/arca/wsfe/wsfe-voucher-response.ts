import "server-only";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ParsedWsfeResult } from "@/server/arca/wsfe/wsfe-response";
import { readWsfeCodedItems, requireWsfeInteger } from "@/server/arca/wsfe/wsfe-response";
import type { ArcaVatRate, ArcaVoucher, ArcaWsfeRemoteError } from "@/server/arca/wsfe/wsfe.types";

const VOUCHER_NOT_FOUND_CODE = "602";
const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const PROCESS_DATE_PATTERN = /^\d{14}$/;

export type ConsultedVoucherIdentity = {
  pointOfSale: number;
  voucherType: number;
  voucherNumber: number;
};

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

function readCalendarDate(value: unknown): string {
  const text = textOf(value);
  const match = text ? DATE_PATTERN.exec(text) : null;

  if (!text || !match) {
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

function readMoney(value: unknown): number {
  const text = textOf(value);
  const match = text ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(text) : null;

  if (!match) {
    throw invalidResponse();
  }

  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw invalidResponse();
  }

  return cents / 100;
}

function readRate(value: unknown): number {
  const text = textOf(value);
  const match = text ? /^(\d+)(?:\.(\d{1,6}))?$/.exec(text) : null;

  if (!match) {
    throw invalidResponse();
  }

  const scale = 1_000_000;
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const units = Number(match[1]) * scale + Number(fraction);

  if (!Number.isSafeInteger(units) || units <= 0) {
    throw invalidResponse();
  }

  return units / scale;
}

function readResult(value: unknown): "A" | "R" {
  const text = textOf(value);

  if (text === "A" || text === "R") {
    return text;
  }

  throw invalidResponse();
}

function readVatBreakdown(detail: Record<string, unknown>): ArcaVatRate[] {
  const container = detail.Iva;

  if (container === undefined || container === null || container === "") {
    return [];
  }

  if (!isRecord(container) || !("AlicIva" in container)) {
    throw invalidResponse();
  }

  const lines = Array.isArray(container.AlicIva) ? container.AlicIva : [container.AlicIva];

  return lines.map((line) => {
    if (!isRecord(line)) {
      throw invalidResponse();
    }

    return {
      id: requireWsfeInteger(line.Id, 1),
      baseAmount: readMoney(line.BaseImp),
      amount: readMoney(line.Importe),
    };
  });
}

export function throwIfVoucherErrors(errors: ArcaWsfeRemoteError[]): void {
  if (errors.length === 0) {
    return;
  }

  if (errors.every((error) => error.code === VOUCHER_NOT_FOUND_CODE)) {
    throw new ArcaWsfeError("El comprobante no está registrado en ARCA.", "VOUCHER_NOT_FOUND", {
      remoteErrors: errors,
    });
  }

  throw new ArcaWsfeError("WSFE rechazó la consulta.", "ARCA_ERROR", {
    remoteErrors: errors,
  });
}

export function parseConsultedVoucher(input: {
  parsed: ParsedWsfeResult;
  identity: ConsultedVoucherIdentity;
  secrets: readonly string[];
}): ArcaVoucher {
  const detail = input.parsed.result.ResultGet;

  if (!isRecord(detail)) {
    throw invalidResponse();
  }

  const voucherFrom = requireWsfeInteger(detail.CbteDesde, 1);
  const voucherTo = requireWsfeInteger(detail.CbteHasta, 1);
  const pointOfSale = requireWsfeInteger(detail.PtoVta, 1);
  const voucherType = requireWsfeInteger(detail.CbteTipo, 1);
  const identityMatches =
    pointOfSale === input.identity.pointOfSale &&
    voucherType === input.identity.voucherType &&
    voucherFrom === input.identity.voucherNumber &&
    voucherTo === input.identity.voucherNumber;

  if (!identityMatches) {
    throw invalidResponse();
  }

  const authorizationCode = textOf(detail.CodAutorizacion);
  const emissionType = textOf(detail.EmisionTipo);
  const processDate = textOf(detail.FchProceso);
  const currencyId = textOf(detail.MonId);

  if (!authorizationCode || !emissionType || !processDate || !PROCESS_DATE_PATTERN.test(processDate)) {
    throw invalidResponse();
  }

  if (!currencyId || !/^[A-Z]{3}$/.test(currencyId)) {
    throw invalidResponse();
  }

  return {
    result: readResult(detail.Resultado),
    authorizationCode,
    emissionType,
    authorizationExpirationDate: readCalendarDate(detail.FchVto),
    processDate,
    pointOfSale,
    voucherType,
    voucherNumber: voucherFrom,
    voucherDate: readCalendarDate(detail.CbteFch),
    concept: requireWsfeInteger(detail.Concepto, 1),
    documentType: requireWsfeInteger(detail.DocTipo, 0),
    documentNumber: requireWsfeInteger(detail.DocNro, 0),
    totalAmount: readMoney(detail.ImpTotal),
    nonTaxedAmount: readMoney(detail.ImpTotConc),
    netAmount: readMoney(detail.ImpNeto),
    exemptAmount: readMoney(detail.ImpOpEx),
    taxAmount: readMoney(detail.ImpTrib),
    vatAmount: readMoney(detail.ImpIVA),
    currencyId,
    currencyRate: readRate(detail.MonCotiz),
    receiverVatConditionId: requireWsfeInteger(detail.CondicionIVAReceptorId, 1),
    vatBreakdown: readVatBreakdown(detail),
    observations: readWsfeCodedItems(detail.Observaciones, "Obs", input.secrets),
    events: input.parsed.events,
  };
}
