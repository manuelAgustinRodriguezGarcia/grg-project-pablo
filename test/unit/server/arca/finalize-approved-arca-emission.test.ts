import { describe, expect, it, vi } from "vitest";
import {
  formatArcaVoucherDate,
  type ArcaCaeFiscalRequest,
} from "@/server/arca/adapters/billing-invoice-to-cae";
import {
  canonicalizeBillingPayload,
  type ArcaBillingPayloadInput,
} from "@/server/arca/invoices/billing-payload-snapshot";
import type { ArcaEmissionRecord } from "@/server/arca/invoices/emission-store";
import {
  finalizeApprovedArcaEmission,
  finalizedInvoiceFromWrite,
  toCreateBillingInvoiceData,
  type ArcaFinalizeGateway,
  type ArcaInvoiceWrite,
  type FinalizeApprovedResult,
  type FinalizedArcaInvoice,
} from "@/server/arca/invoices/finalize-approved-arca-emission";
import {
  resolveArcaFiscalProfile,
  voucherTypeForClass,
} from "@/shared/fiscal/arca-fiscal-mapping";

const CLIENT_CUIT = "30500010912";

function payload(
  overrides: {
    invoiceType?: "A" | "B";
    issuedAt?: string;
    paymentMethod?: ArcaBillingPayloadInput["paymentMethod"];
    paymentStatus?: ArcaBillingPayloadInput["paymentStatus"];
    notes?: string | null;
    description?: string;
    discountAmountCents?: number;
    discountPercent?: number;
    totalVisualRoundedCents?: number;
    ivaCondition?: ArcaBillingPayloadInput["client"]["ivaCondition"];
  } = {},
): ArcaBillingPayloadInput {
  const invoiceType = overrides.invoiceType ?? "B";
  const ivaCondition =
    overrides.ivaCondition ??
    (invoiceType === "A" ? "RESPONSABLE_INSCRIPTO" : "CONSUMIDOR_FINAL");

  return {
    issuedAt: overrides.issuedAt ?? "2026-09-30T15:00:00.000Z",
    pointOfSale: 7,
    invoiceType,
    client: {
      id: "client-1",
      code: "CLI-00001",
      name: "CLIENTE A",
      address: "Calle 1",
      city: "Rosario",
      province: "Santa Fe",
      email: "a@cliente.test",
      whatsapp: "3410000000",
      identificationType: "CUIT",
      identificationNumber: CLIENT_CUIT,
      ivaCondition,
    },
    items: [
      {
        rubroId: "rubro-1",
        rubroCode: "RUB-0001",
        rubroName: "FILTROS",
        description: overrides.description ?? "Filtro de aceite",
        quantity: 1,
        unitPriceCents: 121_000,
        lineTotalCents: 121_000,
        sortOrder: 0,
      },
    ],
    financial: {
      subtotalCents: 121_000,
      discountPercent: overrides.discountPercent ?? 0,
      discountAmountCents: overrides.discountAmountCents ?? 0,
      ivaPercent: 21,
      ivaAmountCents: 21_000,
      totalCents: 121_000,
      totalVisualRoundedCents: overrides.totalVisualRoundedCents ?? 122_000,
      netCents: 100_000,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
    },
    paymentMethod: overrides.paymentMethod ?? "CONTADO",
    paymentStatus: overrides.paymentStatus ?? "PAGA",
    notes: overrides.notes ?? "obs",
  };
}

function fiscalFor(
  billing: ReturnType<typeof canonicalizeBillingPayload>,
  voucherNumber: number,
): ArcaCaeFiscalRequest {
  const profile = resolveArcaFiscalProfile(
    billing.client.identificationType,
    billing.client.ivaCondition,
  );

  return {
    environment: "HOMOLOGACION",
    issuerCuit: "30712345671",
    pointOfSale: billing.pointOfSale,
    voucherType: voucherTypeForClass(billing.invoiceType),
    concept: 1,
    documentType: profile.documentType,
    documentNumber:
      profile.documentNumber === null
        ? Number(billing.client.identificationNumber)
        : profile.documentNumber,
    voucherFrom: voucherNumber,
    voucherTo: voucherNumber,
    voucherDate: formatArcaVoucherDate(new Date(billing.issuedAt)),
    totalAmount: billing.financial.totalCents / 100,
    nonTaxedAmount: billing.financial.nonTaxedCents / 100,
    netAmount: billing.financial.netCents / 100,
    exemptAmount: billing.financial.exemptCents / 100,
    taxAmount: billing.financial.taxCents / 100,
    vatAmount: billing.financial.ivaAmountCents / 100,
    currencyId: "PES",
    currencyRate: 1,
    receiverVatConditionId: profile.receptorVatConditionId,
    vatBreakdown: [],
  };
}

function emission(
  overrides: Partial<ArcaEmissionRecord> = {},
  billingInput = payload(),
): ArcaEmissionRecord {
  const billing = canonicalizeBillingPayload(billingInput);
  const voucherNumber = overrides.voucherNumber === undefined ? 3 : overrides.voucherNumber;

  return {
    id: "emission-1",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    requestHash: "hash",
    environment: "HOMOLOGACION",
    service: "wsfe",
    status: "APPROVED_PENDING_PERSISTENCE",
    issuerCuit: "30712345671",
    pointOfSale: 7,
    invoiceType: billing.invoiceType,
    voucherType: voucherTypeForClass(billing.invoiceType),
    voucherNumber,
    fiscalRequestSnapshot:
      voucherNumber === null ? null : fiscalFor(billing, voucherNumber),
    arcaResult: "A",
    authorizationCode: "12345678901234",
    authorizationExpiresAt: new Date("2026-10-10T00:00:00.000Z"),
    arcaProcessDate: "20261001120000",
    reprocess: "N",
    observations: [],
    errors: [],
    events: [],
    lastErrorCode: null,
    lastErrorMessage: null,
    billingPayloadSnapshot: billing,
    invoiceId: null,
    ...overrides,
  };
}

function createDb() {
  const emissions = new Map<string, ArcaEmissionRecord>();
  const invoices = new Map<string, FinalizedArcaInvoice>();
  let sequence = 0;
  let failCommit = false;
  const commits: string[] = [];
  const tails = new Map<string, Promise<void>>();

  const gateway: ArcaFinalizeGateway = {
    async readEmission(id) {
      return emissions.get(id) ?? null;
    },
    async readInvoice(id) {
      return invoices.get(id) ?? null;
    },
    async commit(emissionId, write) {
      await new Promise((resolve) => setTimeout(resolve, 15));

      if (failCommit) {
        failCommit = false;
        throw new Error("db down");
      }

      const current = emissions.get(emissionId);

      if (current?.status === "COMPLETED" && current.invoiceId) {
        const existing = invoices.get(current.invoiceId);

        if (!existing) {
          throw new Error("missing invoice");
        }

        return existing;
      }

      const key = `${write.environment}|${write.pointOfSale}|${write.invoiceType}|${write.sequenceNumber}`;
      const duplicate = [...invoices.values()].some(
        (invoice) =>
          `${invoice.environment}|${invoice.pointOfSale}|${invoice.invoiceType}|${invoice.sequenceNumber}` ===
          key,
      );

      if (duplicate) {
        throw new Error("unique invoice");
      }

      sequence += 1;
      const invoice = finalizedInvoiceFromWrite(`invoice-${sequence}`, write);
      invoices.set(invoice.id, invoice);

      if (current) {
        emissions.set(emissionId, {
          ...current,
          status: "COMPLETED",
          invoiceId: invoice.id,
        });
      }

      commits.push(emissionId);
      return invoice;
    },
  };

  function run(
    emissionId: string,
    work: (gateway: ArcaFinalizeGateway) => Promise<FinalizeApprovedResult>,
  ): Promise<FinalizeApprovedResult> {
    const previous = tails.get(emissionId) ?? Promise.resolve();
    const task: Promise<FinalizeApprovedResult> = previous.then(
      () => work(gateway),
      () => work(gateway),
    );
    tails.set(
      emissionId,
      task.then(
        () => undefined,
        () => undefined,
      ),
    );
    return task;
  }

  return {
    emissions,
    invoices,
    commits,
    failNext() {
      failCommit = true;
    },
    dependencies() {
      return { run };
    },
  };
}

describe("finalizeApprovedArcaEmission", () => {
  it("persiste la factura autorizada con el snapshot original", async () => {
    const db = createDb();
    const currentClientName = "CLIENTE B";
    const row = emission(
      {},
      payload({
        discountPercent: 10,
        discountAmountCents: 12_100,
        paymentMethod: "CUENTA_CORRIENTE",
        paymentStatus: "IMPAGA",
      }),
    );
    db.emissions.set(row.id, row);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await finalizeApprovedArcaEmission(row.id, db.dependencies());

    expect(currentClientName).toBe("CLIENTE B");
    expect(result.status).toBe("completed");
    expect(result.invoice.clientName).toBe("CLIENTE A");
    expect(result.invoice.clientIdentificationNumber).toBe(CLIENT_CUIT);
    expect(result.invoice.clientIvaCondition).toBe("CONSUMIDOR_FINAL");
    expect(result.invoice.items[0]?.description).toBe("Filtro de aceite");
    expect(result.invoice.items[0]?.rubroName).toBe("FILTROS");
    expect(result.invoice.items[0]?.quantity).toBe("1.00");
    expect(result.invoice.cae).toBe("12345678901234");
    expect(result.invoice.caeExpiresAt).toBe("2026-10-10T00:00:00.000Z");
    expect(result.invoice.sequenceNumber).toBe(3);
    expect(result.invoice.invoiceNumber).toBe("0007-00000003");
    expect(result.invoice.pointOfSale).toBe("0007");
    expect(result.invoice.totalCents).toBe(121_000);
    expect(result.invoice.totalVisualRoundedCents).toBe(122_000);
    expect(result.invoice.discountPercent).toBe("10.00");
    expect(result.invoice.discountAmountCents).toBe(12_100);
    expect(result.invoice.paymentMethod).toBe("CUENTA_CORRIENTE");
    expect(result.invoice.paymentStatus).toBe("IMPAGA");
    expect(result.invoice.notes).toBe("obs");
    expect(result.invoice.fiscalStatus).toBe("AUTORIZADA");
    expect(result.invoice.environment).toBe("HOMOLOGACION");
    expect(result.invoice.qrUrl).toBeNull();
    expect(result.invoice.issuedAt).toBe("2026-09-30T15:00:00.000Z");
    expect(db.emissions.get(row.id)?.status).toBe("COMPLETED");
    expect(db.emissions.get(row.id)?.invoiceId).toBe(result.invoice.id);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const again = await finalizeApprovedArcaEmission(row.id, db.dependencies());
    expect(again.invoice.id).toBe(result.invoice.id);
    expect(db.invoices.size).toBe(1);
    expect(db.commits).toEqual([row.id]);
  });

  it("convierte los centavos del snapshot a decimales de factura", () => {
    const write: ArcaInvoiceWrite = {
      environment: "HOMOLOGACION",
      fiscalStatus: "AUTORIZADA",
      invoiceType: "B",
      pointOfSale: "0007",
      sequenceNumber: 3,
      invoiceNumber: "0007-00000003",
      issuedAt: new Date("2026-09-30T15:00:00.000Z"),
      clientId: "client-1",
      clientCode: "CLI-00001",
      clientName: "CLIENTE A",
      clientAddress: null,
      clientCity: null,
      clientProvince: null,
      clientEmail: null,
      clientWhatsapp: null,
      clientIdentificationType: "CUIT",
      clientIdentificationNumber: CLIENT_CUIT,
      clientIvaCondition: "CONSUMIDOR_FINAL",
      subtotalCents: 121_000,
      discountPercent: "10.00",
      discountAmountCents: 12_100,
      ivaPercent: "21.00",
      ivaAmountCents: 21_000,
      totalCents: 121_000,
      totalVisualRoundedCents: 122_000,
      paymentMethod: "CONTADO",
      paymentStatus: "PAGA",
      notes: null,
      cae: "12345678901234",
      caeExpiresAt: new Date("2026-10-10T00:00:00.000Z"),
      items: [
        {
          rubroId: "rubro-1",
          rubroCode: "RUB-0001",
          rubroName: "FILTROS",
          description: "Filtro de aceite",
          quantity: "1.00",
          unitPriceCents: 121_000,
          lineTotalCents: 121_000,
          sortOrder: 0,
        },
      ],
    };

    const data = toCreateBillingInvoiceData(write);
    expect(data.total.toFixed(2)).toBe("1210.00");
    expect(data.totalVisualRounded.toFixed(2)).toBe("1220.00");
    expect(data.discountAmount.toFixed(2)).toBe("121.00");
    expect(data.fiscalStatus).toBe("AUTORIZADA");
    expect(data.cae).toBe("12345678901234");
    expect(data.issuedAt?.toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it("acepta el borde UTC que en Argentina es el día anterior", async () => {
    const db = createDb();
    const row = emission(
      {},
      payload({ issuedAt: "2026-10-01T02:30:00.000Z" }),
    );
    db.emissions.set(row.id, row);

    const result = await finalizeApprovedArcaEmission(row.id, db.dependencies());

    expect(result.invoice.issuedAt).toBe("2026-10-01T02:30:00.000Z");
    expect(row.fiscalRequestSnapshot?.voucherDate).toBe("20260930");
  });

  it("rechaza una fecha fiscal que no coincide con issuedAt", async () => {
    const db = createDb();
    const row = emission({}, payload({ issuedAt: "2026-10-01T02:30:00.000Z" }));

    if (row.fiscalRequestSnapshot) {
      row.fiscalRequestSnapshot = {
        ...row.fiscalRequestSnapshot,
        voucherDate: "20261001",
      };
    }

    db.emissions.set(row.id, row);

    await expect(
      finalizeApprovedArcaEmission(row.id, db.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_EMISSION_SNAPSHOT_MISMATCH" });
    expect(db.invoices.size).toBe(0);
    expect(db.emissions.get(row.id)?.status).toBe("APPROVED_PENDING_PERSISTENCE");
  });

  it.each([
    "PREPARED",
    "SENDING",
    "REJECTED",
    "AMBIGUOUS",
    "FAILED_PRE_SEND",
  ] as const)("no crea factura si el estado es %s", async (status) => {
    const db = createDb();
    const row = emission({ status, authorizationCode: status === "REJECTED" ? null : "12345678901234" });
    db.emissions.set(row.id, row);

    await expect(
      finalizeApprovedArcaEmission(row.id, db.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_EMISSION_NOT_READY_FOR_PERSISTENCE" });
    expect(db.invoices.size).toBe(0);
  });

  it("no crea factura si falta el CAE o el snapshot", async () => {
    const db = createDb();
    const missingCae = emission({ authorizationCode: null });
    db.emissions.set(missingCae.id, missingCae);

    await expect(
      finalizeApprovedArcaEmission(missingCae.id, db.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_APPROVED_EMISSION_INCOMPLETE" });

    const missingSnapshot = emission({ billingPayloadSnapshot: null });
    db.emissions.set(missingSnapshot.id, missingSnapshot);

    await expect(
      finalizeApprovedArcaEmission(missingSnapshot.id, db.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_APPROVED_EMISSION_INCOMPLETE" });
    expect(db.invoices.size).toBe(0);
  });

  it("revierte la finalización si la base falla y el reintento crea una sola factura", async () => {
    const db = createDb();
    const row = emission();
    db.emissions.set(row.id, row);
    db.failNext();

    await expect(
      finalizeApprovedArcaEmission(row.id, db.dependencies()),
    ).rejects.toThrow("db down");
    expect(db.emissions.get(row.id)?.status).toBe("APPROVED_PENDING_PERSISTENCE");
    expect(db.emissions.get(row.id)?.invoiceId).toBeNull();
    expect(db.emissions.get(row.id)?.authorizationCode).toBe("12345678901234");
    expect(db.invoices.size).toBe(0);

    const result = await finalizeApprovedArcaEmission(row.id, db.dependencies());
    expect(result.invoice.cae).toBe("12345678901234");
    expect(result.invoice.sequenceNumber).toBe(3);
    expect(db.invoices.size).toBe(1);
    expect(db.commits).toEqual([row.id]);
  });

  it("serializa dos finalizaciones de la misma emisión", async () => {
    const db = createDb();
    const row = emission();
    db.emissions.set(row.id, row);

    const [first, second] = await Promise.all([
      finalizeApprovedArcaEmission(row.id, db.dependencies()),
      finalizeApprovedArcaEmission(row.id, db.dependencies()),
    ]);

    expect(first.invoice.id).toBe(second.invoice.id);
    expect(db.invoices.size).toBe(1);
    expect(db.commits).toEqual([row.id]);
  });

  it("permite el mismo número fiscal en Factura A y Factura B", async () => {
    const db = createDb();
    const facturaB = emission({ id: "emission-b" });
    const facturaA = emission(
      { id: "emission-a" },
      payload({ invoiceType: "A" }),
    );
    db.emissions.set(facturaB.id, facturaB);
    db.emissions.set(facturaA.id, facturaA);

    const [resultB, resultA] = await Promise.all([
      finalizeApprovedArcaEmission(facturaB.id, db.dependencies()),
      finalizeApprovedArcaEmission(facturaA.id, db.dependencies()),
    ]);

    expect(resultB.invoice.invoiceNumber).toBe("0007-00000003");
    expect(resultA.invoice.invoiceNumber).toBe("0007-00000003");
    expect(resultA.invoice.invoiceType).toBe("A");
    expect(resultB.invoice.invoiceType).toBe("B");
    expect(db.invoices.size).toBe(2);
  });
});
