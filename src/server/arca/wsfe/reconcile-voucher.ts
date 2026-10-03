import "server-only";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { toFiscalCents } from "@/server/arca/wsfe/wsfe-cae-request";
import { consultVoucher } from "@/server/arca/wsfe/wsfe-client";
import type { ArcaVoucher, ArcaVoucherQuery } from "@/server/arca/wsfe/wsfe.types";

export type AmbiguousVoucherExpectation = {
  documentType: number;
  documentNumber: number;
  voucherDate: string;
  totalAmount: number;
  netAmount: number;
  vatAmount: number;
  currencyId: string;
};

export type VoucherMismatchField =
  | "pointOfSale"
  | "voucherType"
  | "voucherNumber"
  | "documentType"
  | "documentNumber"
  | "voucherDate"
  | "totalAmount"
  | "netAmount"
  | "vatAmount"
  | "currencyId";

export type VoucherReconciliation =
  | {
      status: "authorized";
      authorizationCode: string;
      expirationDate: string;
      emissionType: string;
      result: "A" | "R";
    }
  | { status: "not_found" }
  | { status: "mismatch"; fields: VoucherMismatchField[] };

export type ReconcileVoucherDependencies = {
  getAccessTicket?: (environment: ArcaEnvironment) => Promise<ArcaAccessTicket>;
  consultVoucher?: (query: ArcaVoucherQuery & { now?: Date }) => Promise<ArcaVoucher>;
};

function sameAmount(actual: number, expected: number): boolean {
  return toFiscalCents(actual) === toFiscalCents(expected);
}

function mismatchFields(
  voucher: ArcaVoucher,
  input: {
    pointOfSale: number;
    voucherType: number;
    voucherNumber: number;
    expected: AmbiguousVoucherExpectation;
  },
): VoucherMismatchField[] {
  const fields: VoucherMismatchField[] = [];
  const expected = input.expected;

  if (voucher.pointOfSale !== input.pointOfSale) {
    fields.push("pointOfSale");
  }

  if (voucher.voucherType !== input.voucherType) {
    fields.push("voucherType");
  }

  if (voucher.voucherNumber !== input.voucherNumber) {
    fields.push("voucherNumber");
  }

  if (voucher.documentType !== expected.documentType) {
    fields.push("documentType");
  }

  if (voucher.documentNumber !== expected.documentNumber) {
    fields.push("documentNumber");
  }

  if (voucher.voucherDate !== expected.voucherDate) {
    fields.push("voucherDate");
  }

  if (!sameAmount(voucher.totalAmount, expected.totalAmount)) {
    fields.push("totalAmount");
  }

  if (!sameAmount(voucher.netAmount, expected.netAmount)) {
    fields.push("netAmount");
  }

  if (!sameAmount(voucher.vatAmount, expected.vatAmount)) {
    fields.push("vatAmount");
  }

  if (voucher.currencyId !== expected.currencyId) {
    fields.push("currencyId");
  }

  return fields;
}

export async function reconcileVoucherAfterAmbiguousEmission(
  input: {
    environment: ArcaEnvironment;
    issuerCuit: string;
    pointOfSale: number;
    voucherType: number;
    voucherNumber: number;
    expected: AmbiguousVoucherExpectation;
    now?: Date;
  },
  dependencies: ReconcileVoucherDependencies = {},
): Promise<VoucherReconciliation> {
  const getAccessTicket = dependencies.getAccessTicket ?? getValidArcaAccessTicket;
  const loadVoucher = dependencies.consultVoucher ?? consultVoucher;
  const accessTicket = await getAccessTicket(input.environment);
  let voucher: ArcaVoucher;

  try {
    voucher = await loadVoucher({
      environment: input.environment,
      accessTicket,
      issuerCuit: input.issuerCuit,
      pointOfSale: input.pointOfSale,
      voucherType: input.voucherType,
      voucherNumber: input.voucherNumber,
      now: input.now,
    });
  } catch (error) {
    if (error instanceof ArcaWsfeError && error.code === "VOUCHER_NOT_FOUND") {
      return { status: "not_found" };
    }

    throw error;
  }

  const fields = mismatchFields(voucher, input);

  if (fields.length > 0) {
    return { status: "mismatch", fields };
  }

  return {
    status: "authorized",
    authorizationCode: voucher.authorizationCode,
    expirationDate: voucher.authorizationExpirationDate,
    emissionType: voucher.emissionType,
    result: voucher.result,
  };
}
