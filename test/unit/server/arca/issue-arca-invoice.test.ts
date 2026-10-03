import { describe, expect, it, vi } from "vitest";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  DuplicateArcaEmissionKeyError,
  DuplicateArcaVoucherNumberError,
  type ArcaEmissionRecord,
  type ArcaEmissionStore,
} from "@/server/arca/invoices/emission-store";
import { hashArcaFiscalRequest } from "@/server/arca/invoices/fiscal-request-hash";
import {
  issueArcaInvoice,
  type IssueArcaInvoiceInput,
} from "@/server/arca/invoices/issue-arca-invoice";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import type {
  ArcaCaeAuthorization,
  ArcaCaeRequest,
} from "@/server/arca/wsfe/wsfe.types";

const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";

function ticket(): ArcaAccessTicket {
  return {
    token: "token",
    sign: "sign",
    generationTime: new Date("2026-09-30T12:00:00.000Z"),
    expirationTime: new Date("2026-09-30T18:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
  };
}

type InvoiceInputOverrides = {
  idempotencyKey?: string;
  environment?: IssueArcaInvoiceInput["environment"];
  issuerCuit?: string;
  pointOfSale?: number;
  invoiceType?: IssueArcaInvoiceInput["invoiceType"];
  voucherDate?: IssueArcaInvoiceInput["voucherDate"];
  ivaPercent?: number;
  client?: Partial<IssueArcaInvoiceInput["client"]>;
  totals?: Partial<IssueArcaInvoiceInput["totals"]>;
  billing?: {
    issuedAt?: string;
    pointOfSale?: number;
    invoiceType?: IssueArcaInvoiceInput["invoiceType"];
    client?: Partial<IssueArcaInvoiceInput["billing"]["client"]>;
    items?: IssueArcaInvoiceInput["billing"]["items"];
    financial?: Partial<IssueArcaInvoiceInput["billing"]["financial"]>;
    paymentMethod?: IssueArcaInvoiceInput["billing"]["paymentMethod"];
    paymentStatus?: IssueArcaInvoiceInput["billing"]["paymentStatus"];
    notes?: string | null;
  };
};

function invoiceInput(overrides: InvoiceInputOverrides = {}): IssueArcaInvoiceInput {
  const client = {
    identificationType: "CUIT" as const,
    identificationNumber: CLIENT_CUIT,
    ivaCondition: "CONSUMIDOR_FINAL" as const,
    ...overrides.client,
  };
  const totals = {
    netCents: 100_000,
    vatCents: 21_000,
    totalCents: 121_000,
    nonTaxedCents: 0,
    exemptCents: 0,
    taxCents: 0,
    ...overrides.totals,
  };
  const invoiceType = overrides.invoiceType ?? "B";
  const pointOfSale = overrides.pointOfSale ?? 7;
  const ivaPercent = overrides.ivaPercent ?? 21;
  const billing = overrides.billing;

  return {
    idempotencyKey:
      overrides.idempotencyKey ?? "11111111-1111-4111-8111-111111111111",
    environment: overrides.environment ?? "HOMOLOGACION",
    issuerCuit: overrides.issuerCuit ?? ISSUER_CUIT,
    pointOfSale,
    invoiceType,
    voucherDate: overrides.voucherDate ?? "2026-09-30",
    ivaPercent,
    client,
    totals,
    billing: {
      issuedAt: billing?.issuedAt ?? "2026-09-30T15:00:00.000Z",
      pointOfSale: billing?.pointOfSale ?? pointOfSale,
      invoiceType: billing?.invoiceType ?? invoiceType,
      client: {
        id: billing?.client?.id ?? "client-1",
        code: billing?.client?.code ?? "CLI-00001",
        name: billing?.client?.name ?? "CLIENTE A",
        address: billing?.client?.address ?? "Calle 1",
        city: billing?.client?.city ?? "Rosario",
        province: billing?.client?.province ?? "Santa Fe",
        email: billing?.client?.email ?? null,
        whatsapp: billing?.client?.whatsapp ?? null,
        identificationType: client.identificationType,
        identificationNumber: client.identificationNumber,
        ivaCondition: client.ivaCondition,
      },
      items: billing?.items ?? [
        {
          rubroId: "rubro-1",
          rubroCode: "RUB-0001",
          rubroName: "FILTROS",
          description: "Filtro de aceite",
          quantity: 1,
          unitPriceCents: totals.totalCents,
          lineTotalCents: totals.totalCents,
          sortOrder: 0,
        },
      ],
      financial: {
        subtotalCents: billing?.financial?.subtotalCents ?? totals.totalCents,
        discountPercent: billing?.financial?.discountPercent ?? 0,
        discountAmountCents: billing?.financial?.discountAmountCents ?? 0,
        ivaPercent: billing?.financial?.ivaPercent ?? ivaPercent,
        ivaAmountCents: billing?.financial?.ivaAmountCents ?? totals.vatCents,
        totalCents: billing?.financial?.totalCents ?? totals.totalCents,
        totalVisualRoundedCents:
          billing?.financial?.totalVisualRoundedCents ?? totals.totalCents,
        netCents: billing?.financial?.netCents ?? totals.netCents,
        nonTaxedCents: billing?.financial?.nonTaxedCents ?? totals.nonTaxedCents,
        exemptCents: billing?.financial?.exemptCents ?? totals.exemptCents,
        taxCents: billing?.financial?.taxCents ?? totals.taxCents,
      },
      paymentMethod: billing?.paymentMethod ?? "CONTADO",
      paymentStatus: billing?.paymentStatus ?? "PAGA",
      notes: billing?.notes ?? null,
    },
  };
}

function approved(voucherNumber: number, voucherType = 6): ArcaCaeAuthorization {
  return {
    status: "approved",
    result: "A",
    cae: "12345678901234",
    caeExpirationDate: "20261010",
    header: {
      cuit: ISSUER_CUIT,
      pointOfSale: 7,
      voucherType,
      processDate: "20261001120000",
      recordCount: 1,
      result: "A",
      reprocess: "N",
    },
    detail: {
      concept: 1,
      documentType: 80,
      documentNumber: Number(CLIENT_CUIT),
      voucherFrom: voucherNumber,
      voucherTo: voucherNumber,
      voucherDate: "20260930",
      result: "A",
      observations: [],
    },
    observations: [],
    errors: [],
    events: [],
  };
}

function rejected(voucherNumber: number): ArcaCaeAuthorization {
  return {
    status: "rejected",
    result: "R",
    cae: null,
    caeExpirationDate: null,
    header: {
      cuit: ISSUER_CUIT,
      pointOfSale: 7,
      voucherType: 6,
      processDate: "20261001120000",
      recordCount: 1,
      result: "R",
      reprocess: "N",
    },
    detail: {
      concept: 1,
      documentType: 80,
      documentNumber: Number(CLIENT_CUIT),
      voucherFrom: voucherNumber,
      voucherTo: voucherNumber,
      voucherDate: "20260930",
      result: "R",
      observations: [{ code: "100", message: "rechazado" }],
    },
    observations: [{ code: "100", message: "rechazado" }],
    errors: [],
    events: [],
  };
}

function createHarness(lastNumber = 2) {
  const rows = new Map<string, ArcaEmissionRecord>();
  let sequence = 0;
  const lastByType = new Map<number, number>([
    [1, lastNumber],
    [6, lastNumber],
  ]);
  const scopes: string[] = [];
  const tails = new Map<string, Promise<unknown>>();
  const requestCae = vi.fn(async (request: ArcaCaeRequest) => {
    const row = [...rows.values()].find(
      (item) => item.voucherNumber === request.voucherFrom,
    );
    expect(row?.status).toBe("SENDING");
    expect(JSON.stringify(row?.fiscalRequestSnapshot)).not.toContain("token");
    expect(JSON.stringify(row?.fiscalRequestSnapshot)).not.toContain("sign");
    expect(row?.fiscalRequestSnapshot).not.toHaveProperty("accessTicket");
    lastByType.set(request.voucherType, request.voucherFrom);
    return approved(request.voucherFrom, request.voucherType);
  });
  const getLastAuthorizedVoucher = vi.fn(
    async (input: { pointOfSale: number; voucherType: number }) => ({
      pointOfSale: input.pointOfSale,
      voucherType: input.voucherType,
      lastNumber: lastByType.get(input.voucherType) ?? 0,
      events: [],
    }),
  );
  const getAccessTicket = vi.fn(async () => ticket());
  const reconcile = vi.fn();

  const store: ArcaEmissionStore = {
    async findByIdempotencyKey(key) {
      return [...rows.values()].find((row) => row.idempotencyKey === key) ?? null;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async createPrepared(data) {
      if ([...rows.values()].some((row) => row.idempotencyKey === data.idempotencyKey)) {
        throw new DuplicateArcaEmissionKeyError();
      }
      sequence += 1;
      const row: ArcaEmissionRecord = {
        id: `emission-${sequence}`,
        ...data,
        service: "wsfe",
        status: "PREPARED",
        voucherNumber: null,
        fiscalRequestSnapshot: null,
        arcaResult: null,
        authorizationCode: null,
        authorizationExpiresAt: null,
        arcaProcessDate: null,
        reprocess: null,
        observations: [],
        errors: [],
        events: [],
        lastErrorCode: null,
        lastErrorMessage: null,
        invoiceId: null,
      };
      rows.set(row.id, row);
      return row;
    },
    async updateSending(id, data) {
      const taken = [...rows.values()].some(
        (row) =>
          row.id !== id &&
          row.voucherNumber === data.voucherNumber &&
          row.pointOfSale === rows.get(id)?.pointOfSale &&
          row.voucherType === data.voucherType &&
          row.environment === rows.get(id)?.environment,
      );
      if (taken) {
        throw new DuplicateArcaVoucherNumberError();
      }
      const row = rows.get(id);
      if (!row) {
        throw new Error("missing");
      }
      const next = {
        ...row,
        status: "SENDING" as const,
        voucherNumber: data.voucherNumber,
        voucherType: data.voucherType,
        fiscalRequestSnapshot: data.fiscalRequestSnapshot,
      };
      rows.set(id, next);
      return next;
    },
    async markApproved(id, data) {
      const row = rows.get(id);
      if (!row) {
        throw new Error("missing");
      }
      const next: ArcaEmissionRecord = {
        ...row,
        status: "APPROVED_PENDING_PERSISTENCE",
        arcaResult: "A",
        authorizationCode: data.authorizationCode,
        authorizationExpiresAt: data.authorizationExpiresAt,
        arcaProcessDate: data.arcaProcessDate,
        reprocess: data.reprocess,
        observations: data.observations,
        events: data.events,
      };
      rows.set(id, next);
      return next;
    },
    async markRejected(id, data) {
      const row = rows.get(id);
      if (!row) {
        throw new Error("missing");
      }
      const next: ArcaEmissionRecord = {
        ...row,
        status: "REJECTED",
        arcaResult: "R",
        observations: data.observations,
        errors: data.errors,
        events: data.events,
      };
      rows.set(id, next);
      return next;
    },
    async markAmbiguous(id, data) {
      const row = rows.get(id);
      if (!row) {
        throw new Error("missing");
      }
      const next: ArcaEmissionRecord = {
        ...row,
        status: "AMBIGUOUS",
        lastErrorCode: data.code,
        lastErrorMessage: data.message,
      };
      rows.set(id, next);
      return next;
    },
    async markFailedPreSend(id, data) {
      const row = rows.get(id);
      if (!row) {
        throw new Error("missing");
      }
      const next: ArcaEmissionRecord = {
        ...row,
        status: "FAILED_PRE_SEND",
        lastErrorCode: data.code,
        lastErrorMessage: data.message,
        voucherNumber: data.clearVoucherNumber ? null : row.voucherNumber,
        fiscalRequestSnapshot: data.clearVoucherNumber
          ? null
          : row.fiscalRequestSnapshot,
      };
      rows.set(id, next);
      return next;
    },
  };

  async function lock<T>(scope: string, task: () => Promise<T>): Promise<T> {
    scopes.push(scope);
    const previous = tails.get(scope) ?? Promise.resolve();
    const run = previous.then(task, task);
    tails.set(
      scope,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  function dependencies() {
    return {
      store,
      lock,
      getAccessTicket,
      getLastAuthorizedVoucher,
      requestCae,
      reconcile,
    };
  }

  return {
    rows,
    scopes,
    requestCae,
    getLastAuthorizedVoucher,
    getAccessTicket,
    reconcile,
    dependencies,
    noteAuthorized(voucherType: number, voucherNumber: number) {
      lastByType.set(voucherType, voucherNumber);
    },
  };
}

describe("hashArcaFiscalRequest", () => {
  it("no cambia por el orden ni por datos que no van al pedido", () => {
    const left = hashArcaFiscalRequest(invoiceInput());
    const right = hashArcaFiscalRequest(
      invoiceInput({
        issuerCuit: "30-71234567-1",
        client: {
          identificationType: "CUIT",
          identificationNumber: "30-50001091-2",
          ivaCondition: "CONSUMIDOR_FINAL",
        },
      }),
    );

    expect(left).toBe(right);
    expect(hashArcaFiscalRequest(invoiceInput({ ivaPercent: 10.5 }))).not.toBe(left);
  });

  it("cambia si cambia la descripción, la cantidad, el pago, las notas o el total visual", () => {
    const base = hashArcaFiscalRequest(invoiceInput());
    const otherDescription = invoiceInput();
    otherDescription.billing.items[0].description = "Filtro de aire";

    const compensated = invoiceInput();
    compensated.billing.items = [
      {
        rubroId: "rubro-1",
        rubroCode: "RUB-0001",
        rubroName: "FILTROS",
        description: "Filtro de aceite",
        quantity: 2,
        unitPriceCents: 60_500,
        lineTotalCents: 121_000,
        sortOrder: 0,
      },
    ];

    expect(hashArcaFiscalRequest(otherDescription)).not.toBe(base);
    expect(hashArcaFiscalRequest(compensated)).not.toBe(base);
    expect(
      hashArcaFiscalRequest(invoiceInput({ billing: { paymentMethod: "TARJETA" } })),
    ).not.toBe(base);
    expect(hashArcaFiscalRequest(invoiceInput({ billing: { notes: "urgente" } }))).not.toBe(
      base,
    );
    expect(
      hashArcaFiscalRequest(
        invoiceInput({
          billing: { financial: { totalVisualRoundedCents: 122_000 } },
        }),
      ),
    ).not.toBe(base);
    expect(hashArcaFiscalRequest(invoiceInput())).toBe(base);
  });
});

describe("issueArcaInvoice", () => {
  it("crea la intención, toma el último número y llama a CAE una vez", async () => {
    const harness = createHarness(2);
    const result = await issueArcaInvoice(
      invoiceInput(),
      harness.dependencies(),
    );

    expect(result.status).toBe("approved");
    expect(harness.rows.size).toBe(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.requestCae.mock.calls[0]?.[0].voucherFrom).toBe(3);
    expect(harness.requestCae.mock.calls[0]?.[0].voucherTo).toBe(3);
    expect([...harness.rows.values()][0]?.status).toBe(
      "APPROVED_PENDING_PERSISTENCE",
    );
    expect(
      [...harness.rows.values()][0]?.billingPayloadSnapshot?.client.name,
    ).toBe("CLIENTE A");
    expect(
      JSON.stringify([...harness.rows.values()][0]?.billingPayloadSnapshot),
    ).not.toContain("token");
  });

  it.each([
    ["B", 0, 1, "22222222-2222-4222-8222-222222222221"],
    ["A", 0, 1, "33333333-3333-4333-8333-333333333331"],
    ["B", 8, 9, "44444444-4444-4444-8444-444444444449"],
  ] as const)(
    "en producción factura %s con último %i solicita el número %i",
    async (invoiceType, lastNumber, expectedNumber, idempotencyKey) => {
      const harness = createHarness(lastNumber);
      const result = await issueArcaInvoice(
        invoiceInput({
          environment: "PRODUCCION",
          invoiceType,
          idempotencyKey,
          client:
            invoiceType === "A"
              ? {
                  identificationType: "CUIT",
                  identificationNumber: CLIENT_CUIT,
                  ivaCondition: "RESPONSABLE_INSCRIPTO",
                }
              : undefined,
        }),
        harness.dependencies(),
      );

      expect(result.status).toBe("approved");
      expect(harness.getAccessTicket).toHaveBeenCalledWith("PRODUCCION");
      expect(harness.getLastAuthorizedVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "PRODUCCION",
          voucherType: invoiceType === "A" ? 1 : 6,
        }),
      );
      expect(harness.requestCae).toHaveBeenCalledTimes(1);
      expect(harness.requestCae.mock.calls[0]?.[0]).toMatchObject({
        environment: "PRODUCCION",
        voucherType: invoiceType === "A" ? 1 : 6,
        voucherFrom: expectedNumber,
        voucherTo: expectedNumber,
      });
      expect([...harness.rows.values()][0]?.environment).toBe("PRODUCCION");
    },
  );

  it("reutiliza la misma clave y el mismo hash sin una segunda emisión", async () => {
    const harness = createHarness(2);
    await issueArcaInvoice(invoiceInput(), harness.dependencies());
    const second = await issueArcaInvoice(invoiceInput(), harness.dependencies());

    expect(second.status).toBe("approved");
    expect(harness.rows.size).toBe(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.getLastAuthorizedVoucher).toHaveBeenCalledTimes(1);
  });

  it("rechaza la misma clave con otro payload", async () => {
    const harness = createHarness(2);
    await issueArcaInvoice(invoiceInput(), harness.dependencies());

    await expect(
      issueArcaInvoice(
        invoiceInput({
          totals: {
            netCents: 200_000,
            vatCents: 42_000,
            totalCents: 242_000,
            nonTaxedCents: 0,
            exemptCents: 0,
            taxCents: 0,
          },
        }),
        harness.dependencies(),
      ),
    ).rejects.toBeInstanceOf(ArcaEmissionError);

    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("rechaza la misma clave si cambia un ítem con el mismo total", async () => {
    const harness = createHarness(2);
    await issueArcaInvoice(invoiceInput(), harness.dependencies());
    const changed = invoiceInput();
    changed.billing.items[0].description = "Otro filtro";

    await expect(
      issueArcaInvoice(changed, harness.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_IDEMPOTENCY_CONFLICT" });
    expect(harness.rows.size).toBe(1);
  });

  it.each(["APPROVED_PENDING_PERSISTENCE", "REJECTED", "COMPLETED"] as const)(
    "no llama a WSFE si el estado ya es %s",
    async (status) => {
      const harness = createHarness();
      const input = invoiceInput();
      const row: ArcaEmissionRecord = {
        id: "emission-seed",
        idempotencyKey: input.idempotencyKey,
        requestHash: hashArcaFiscalRequest(input),
        environment: "HOMOLOGACION",
        service: "wsfe",
        status,
        issuerCuit: ISSUER_CUIT,
        pointOfSale: 7,
        invoiceType: "B",
        voucherType: 6,
        voucherNumber: 3,
        fiscalRequestSnapshot: null,
        arcaResult: status === "REJECTED" ? "R" : "A",
        authorizationCode: status === "REJECTED" ? null : "12345678901234",
        authorizationExpiresAt: new Date("2026-10-10T00:00:00.000Z"),
        arcaProcessDate: null,
        reprocess: "N",
        observations: [],
        errors: [],
        events: [],
        lastErrorCode: null,
        lastErrorMessage: null,
        billingPayloadSnapshot: null,
        invoiceId: null,
      };
      harness.rows.set(row.id, row);

      const result = await issueArcaInvoice(input, harness.dependencies());

      expect(result.status).toBe(
        status === "COMPLETED" ? "completed" : status === "REJECTED" ? "rejected" : "approved",
      );
      expect(harness.requestCae).not.toHaveBeenCalled();
      expect(harness.getLastAuthorizedVoucher).not.toHaveBeenCalled();
      expect(harness.getAccessTicket).not.toHaveBeenCalled();
    },
  );

  it("serializa dos Facturas B y deja Factura A en otro lock", async () => {
    const harness = createHarness(2);
    let active = 0;
    let maxActive = 0;
    harness.requestCae.mockImplementation(async (request: ArcaCaeRequest) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      harness.noteAuthorized(request.voucherType, request.voucherFrom);
      active -= 1;
      return approved(request.voucherFrom, request.voucherType);
    });

    const [first, second, facturaA] = await Promise.all([
      issueArcaInvoice(invoiceInput({ idempotencyKey: "b-1" }), harness.dependencies()),
      issueArcaInvoice(invoiceInput({ idempotencyKey: "b-2" }), harness.dependencies()),
      issueArcaInvoice(
        invoiceInput({
          idempotencyKey: "a-1",
          invoiceType: "A",
          client: {
            identificationType: "CUIT",
            identificationNumber: CLIENT_CUIT,
            ivaCondition: "RESPONSABLE_INSCRIPTO",
          },
        }),
        harness.dependencies(),
      ),
    ]);

    expect([first.status, second.status, facturaA.status]).toEqual([
      "approved",
      "approved",
      "approved",
    ]);
    const numbersFor = (voucherType: number) =>
      harness.requestCae.mock.calls
        .map((call) => call[0])
        .filter((request) => request.voucherType === voucherType)
        .map((request) => request.voucherFrom)
        .sort();
    expect(numbersFor(6)).toEqual([3, 4]);
    expect(numbersFor(1)).toEqual([3]);
    expect(maxActive).toBe(2);
    expect(harness.scopes).toContain("HOMOLOGACION|7|6");
    expect(harness.scopes).toContain("HOMOLOGACION|7|1");
  });

  it("deja la emisión ambigua si CAE no responde y no reintenta", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockRejectedValue(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );

    const result = await issueArcaInvoice(invoiceInput(), harness.dependencies());

    expect(result.status).toBe("ambiguous");
    expect([...harness.rows.values()][0]?.status).toBe("AMBIGUOUS");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("reconcilia una emisión ambigua sin volver a pedir CAE", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );
    await issueArcaInvoice(invoiceInput(), harness.dependencies());
    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });

    const result = await issueArcaInvoice(invoiceInput(), harness.dependencies());

    expect(result.status).toBe("approved");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.status).toBe(
      "APPROVED_PENDING_PERSISTENCE",
    );
  });

  it("mantiene ambigua una reconciliación que no coincide y no reemite", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );
    await issueArcaInvoice(invoiceInput(), harness.dependencies());
    harness.reconcile.mockResolvedValue({ status: "mismatch", fields: ["totalAmount"] });

    await expect(
      issueArcaInvoice(invoiceInput(), harness.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_AMBIGUOUS_VOUCHER_MISMATCH" });

    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.status).toBe("AMBIGUOUS");
  });

  it("no reemite si la reconciliación no encuentra el comprobante", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );
    await issueArcaInvoice(invoiceInput(), harness.dependencies());
    harness.reconcile.mockResolvedValue({ status: "not_found" });

    await expect(
      issueArcaInvoice(invoiceInput(), harness.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND" });

    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("guarda el rechazo y no vuelve a emitir", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockResolvedValue(rejected(3));
    const first = await issueArcaInvoice(invoiceInput(), harness.dependencies());
    const second = await issueArcaInvoice(invoiceInput(), harness.dependencies());

    expect(first.status).toBe("rejected");
    expect(second.status).toBe("rejected");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.status).toBe("REJECTED");
  });

  it("no llama a CAE si falla el último autorizado, el ticket o el adapter", async () => {
    const lastFails = createHarness(2);
    lastFails.getLastAuthorizedVoucher.mockRejectedValue(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );
    const lastResult = await issueArcaInvoice(invoiceInput(), lastFails.dependencies());
    expect(lastResult.status).toBe("failed_pre_send");
    expect(lastFails.requestCae).not.toHaveBeenCalled();

    const ticketFails = createHarness(2);
    ticketFails.getAccessTicket.mockRejectedValue(
      new ArcaWsfeError("El ticket de acceso no es válido.", "INVALID_TICKET"),
    );
    const ticketResult = await issueArcaInvoice(
      invoiceInput({ idempotencyKey: "ticket" }),
      ticketFails.dependencies(),
    );
    expect(ticketResult.status).toBe("failed_pre_send");
    expect(ticketFails.requestCae).not.toHaveBeenCalled();

    const adapterFails = createHarness(2);
    const adapterResult = await issueArcaInvoice(
      invoiceInput({ idempotencyKey: "adapter", ivaPercent: 10.5 }),
      adapterFails.dependencies(),
    );
    expect(adapterResult.status).toBe("failed_pre_send");
    if (adapterResult.status !== "failed_pre_send") {
      throw new Error("Se esperaba un fallo previo al envío.");
    }
    expect(adapterResult.code).toBe("ARCA_UNSUPPORTED_VAT_RATE");
    expect(adapterFails.requestCae).not.toHaveBeenCalled();
  });

  it("trata INVALID_CAE_REQUEST como previo al envío", async () => {
    const harness = createHarness(2);
    harness.requestCae.mockRejectedValue(
      new ArcaWsfeError("La solicitud de CAE no es válida.", "INVALID_CAE_REQUEST"),
    );

    const result = await issueArcaInvoice(invoiceInput(), harness.dependencies());

    expect(result.status).toBe("failed_pre_send");
    if (result.status !== "failed_pre_send") {
      throw new Error("Se esperaba un fallo previo al envío.");
    }
    expect(result.code).toBe("INVALID_CAE_REQUEST");
    expect([...harness.rows.values()][0]?.status).toBe("FAILED_PRE_SEND");
    expect([...harness.rows.values()][0]?.voucherNumber).toBeNull();
  });
});
