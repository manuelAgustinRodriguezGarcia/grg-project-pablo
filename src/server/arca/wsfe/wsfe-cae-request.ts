import "server-only";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import type { FeCaeRequestXml } from "@/server/arca/wsfe/wsfe-soap";

const CURRENCY_ID_PATTERN = /^[A-Z]{3}$/;
const VOUCHER_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

function invalidCaeRequest(): ArcaWsfeError {
  return new ArcaWsfeError("La solicitud de CAE no es válida.", "INVALID_CAE_REQUEST");
}

export function toFiscalCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw invalidCaeRequest();
  }

  const cents = Math.round(value * 100);

  if (Math.abs(value * 100 - cents) > 1e-6) {
    throw invalidCaeRequest();
  }

  return cents;
}

function formatCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function assertMoney(value: number, minimumCents: number): string {
  const cents = toFiscalCents(value);

  if (cents < minimumCents) {
    throw invalidCaeRequest();
  }

  return formatCents(cents);
}

function assertSafeInteger(value: number, minimum: number, maximum?: number): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw invalidCaeRequest();
  }

  if (maximum !== undefined && value > maximum) {
    throw invalidCaeRequest();
  }

  return value;
}

function assertVoucherDate(value: string): string {
  const match = VOUCHER_DATE_PATTERN.exec(value);

  if (!match) {
    throw invalidCaeRequest();
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
    throw invalidCaeRequest();
  }

  return value;
}

export function serializeCaeRequest(input: ArcaCaeRequest): FeCaeRequestXml {
  const pointOfSale = assertSafeInteger(input.pointOfSale, 1, 99999);
  const voucherType = assertSafeInteger(input.voucherType, 1);
  const concept = assertSafeInteger(input.concept, 1);
  const documentType = assertSafeInteger(input.documentType, 0);
  const documentNumber = assertSafeInteger(input.documentNumber, 0);
  const voucherFrom = assertSafeInteger(input.voucherFrom, 1);
  const voucherTo = assertSafeInteger(input.voucherTo, voucherFrom);
  const voucherDate = assertVoucherDate(input.voucherDate);
  const nonTaxedAmount = assertMoney(input.nonTaxedAmount, 0);
  const netAmount = assertMoney(input.netAmount, 0);
  const exemptAmount = assertMoney(input.exemptAmount, 0);
  const taxAmount = assertMoney(input.taxAmount, 0);
  const vatAmount = assertMoney(input.vatAmount, 0);
  const totalAmount = assertMoney(input.totalAmount, 0);
  const currencyRate = assertMoney(input.currencyRate, 1);
  const receiverVatConditionId = assertSafeInteger(input.receiverVatConditionId, 1);

  if (!CURRENCY_ID_PATTERN.test(input.currencyId)) {
    throw invalidCaeRequest();
  }

  if (!Array.isArray(input.vatBreakdown)) {
    throw invalidCaeRequest();
  }

  const vatLines = input.vatBreakdown.map((line) => ({
    id: assertSafeInteger(line.id, 1),
    baseAmount: assertMoney(line.baseAmount, 0),
    amount: assertMoney(line.amount, 0),
  }));
  const vatCents = toFiscalCents(input.vatAmount);
  const breakdownCents = input.vatBreakdown.reduce(
    (sum, line) => sum + toFiscalCents(line.amount),
    0,
  );

  if (vatCents > 0 && vatLines.length === 0) {
    throw invalidCaeRequest();
  }

  if (vatLines.length > 0 && breakdownCents !== vatCents) {
    throw invalidCaeRequest();
  }

  const expectedTotal =
    toFiscalCents(input.nonTaxedAmount) +
    toFiscalCents(input.netAmount) +
    toFiscalCents(input.exemptAmount) +
    toFiscalCents(input.taxAmount) +
    vatCents;

  if (toFiscalCents(input.totalAmount) !== expectedTotal) {
    throw invalidCaeRequest();
  }

  return {
    pointOfSale,
    voucherType,
    concept,
    documentType,
    documentNumber,
    voucherFrom,
    voucherTo,
    voucherDate,
    totalAmount,
    nonTaxedAmount,
    netAmount,
    exemptAmount,
    taxAmount,
    vatAmount,
    currencyId: input.currencyId,
    currencyRate,
    receiverVatConditionId,
    vatLines,
  };
}
