import { describe, expect, it, vi } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { reconcileVoucherAfterAmbiguousEmission } from "@/server/arca/wsfe/reconcile-voucher";
import type { ArcaVoucher } from "@/server/arca/wsfe/wsfe.types";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";

const AUTHORIZATION = "12345678901234";

function ticket(): ArcaAccessTicket {
  return {
    token: "token-prueba",
    sign: "sign-prueba",
    generationTime: new Date("2026-09-30T17:00:00.000Z"),
    expirationTime: new Date("2026-09-30T21:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
  };
}

function voucher(overrides?: Partial<ArcaVoucher>): ArcaVoucher {
  return {
    result: "A",
    authorizationCode: AUTHORIZATION,
    emissionType: "CAE",
    authorizationExpirationDate: "20261010",
    processDate: "20260930170000",
    pointOfSale: 7,
    voucherType: 6,
    voucherNumber: 2,
    voucherDate: "20260930",
    concept: 1,
    documentType: 99,
    documentNumber: 0,
    totalAmount: 1210,
    nonTaxedAmount: 0,
    netAmount: 1000,
    exemptAmount: 0,
    taxAmount: 0,
    vatAmount: 210,
    currencyId: "PES",
    currencyRate: 1,
    receiverVatConditionId: 5,
    vatBreakdown: [{ id: 5, baseAmount: 1000, amount: 210 }],
    observations: [],
    events: [],
    ...overrides,
  };
}

function expected() {
  return {
    documentType: 99,
    documentNumber: 0,
    voucherDate: "20260930",
    totalAmount: 1210,
    netAmount: 1000,
    vatAmount: 210,
    currencyId: "PES",
  };
}

function reconcile(consult: (query: unknown) => Promise<ArcaVoucher>) {
  const getAccessTicket = vi.fn(async () => ticket());
  const consultVoucher = vi.fn(consult);

  return {
    getAccessTicket,
    consultVoucher,
    run: () =>
      reconcileVoucherAfterAmbiguousEmission(
        {
          environment: "HOMOLOGACION",
          issuerCuit: "30712345678",
          pointOfSale: 7,
          voucherType: 6,
          voucherNumber: 2,
          expected: expected(),
        },
        { getAccessTicket, consultVoucher },
      ),
  };
}

describe("reconcileVoucherAfterAmbiguousEmission", () => {
  it("autoriza cuando los datos fiscales coinciden", async () => {
    const harness = reconcile(async () => voucher());
    const outcome = await harness.run();

    expect(harness.consultVoucher).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      status: "authorized",
      authorizationCode: AUTHORIZATION,
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });
  });

  it("informa not_found sin confundirlo con un error de red", async () => {
    const harness = reconcile(async () => {
      throw new ArcaWsfeError("El comprobante no está registrado en ARCA.", "VOUCHER_NOT_FOUND");
    });

    await expect(harness.run()).resolves.toEqual({ status: "not_found" });
    expect(harness.consultVoucher).toHaveBeenCalledTimes(1);
  });

  it("marca mismatch si el total no coincide", async () => {
    const harness = reconcile(async () => voucher({ totalAmount: 1211 }));

    await expect(harness.run()).resolves.toEqual({
      status: "mismatch",
      fields: ["totalAmount"],
    });
  });

  it("marca mismatch si el documento no coincide", async () => {
    const harness = reconcile(async () => voucher({ documentType: 80, documentNumber: 20111111112 }));

    await expect(harness.run()).resolves.toEqual({
      status: "mismatch",
      fields: ["documentType", "documentNumber"],
    });
  });

  it("marca mismatch si la fecha no coincide", async () => {
    const harness = reconcile(async () => voucher({ voucherDate: "20261001" }));

    await expect(harness.run()).resolves.toEqual({
      status: "mismatch",
      fields: ["voucherDate"],
    });
  });

  it("marca mismatch si el IVA no coincide", async () => {
    const harness = reconcile(async () => voucher({ vatAmount: 105 }));

    await expect(harness.run()).resolves.toEqual({
      status: "mismatch",
      fields: ["vatAmount"],
    });
  });

  it("propaga un error de red y no lo convierte en not_found", async () => {
    const harness = reconcile(async () => {
      throw new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR");
    });

    await expect(harness.run()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(harness.consultVoucher).toHaveBeenCalledTimes(1);
  });
});
