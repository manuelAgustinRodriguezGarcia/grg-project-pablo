import { inflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));
import { Prisma } from "@/generated/prisma/client";
import type { BillingArcaEmission } from "@/generated/prisma/client";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  DuplicateArcaEmissionKeyError,
  DuplicateArcaVoucherNumberError,
  type ArcaEmissionRecord,
  type ArcaEmissionStore,
} from "@/server/arca/invoices/emission-store";
import { issueArcaNote } from "@/server/arca/notes/issue-arca-note";
import { buildNotePdf } from "@/server/pdf/build-note-pdf";
import type { IssueArcaNoteInput } from "@/server/arca/notes/issue-arca-note";
import { commitApprovedNote } from "@/server/arca/notes/finalize-approved-arca-note-emission.db";
import { hashArcaNoteRequest } from "@/server/arca/notes/note-request-hash";
import {
  canonicalizeArcaNotePayload,
  parseArcaNoteBillingSnapshot,
} from "@/server/arca/notes/note-payload-snapshot";
import {
  canonicalizeBillingPayload,
  parseBillingPayloadSnapshot,
} from "@/server/arca/invoices/billing-payload-snapshot";
import { buildApprovedNoteWrite } from "@/server/arca/notes/finalize-approved-arca-note-emission";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import type { ArcaCaeAuthorization, ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";

const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";
const ASSOCIATED_CAE = "71234567890123";

function ticket(): ArcaAccessTicket {
  return {
    token: "token",
    sign: "sign",
    generationTime: new Date("2026-10-03T12:00:00.000Z"),
    expirationTime: new Date("2026-10-03T18:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
  };
}

function approved(voucherNumber: number, voucherType: number): ArcaCaeAuthorization {
  return {
    status: "approved",
    result: "A",
    cae: "12345678901234",
    caeExpirationDate: "20261010",
    header: {
      cuit: ISSUER_CUIT,
      pointOfSale: 7,
      voucherType,
      processDate: "20261003120000",
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
      voucherDate: "20261003",
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
    ...approved(voucherNumber, 3),
    status: "rejected",
    result: "R",
    cae: null,
    caeExpirationDate: null,
    observations: [{ code: "100", message: "rechazado" }],
    detail: {
      ...approved(voucherNumber, 3).detail,
      result: "R",
      observations: [{ code: "100", message: "rechazado" }],
    },
  };
}

function source(
  overrides: {
    environment?: ArcaNoteEmissionSource["invoice"]["environment"];
    invoiceType?: "A" | "B";
    paymentMethod?: ArcaNoteEmissionSource["invoice"]["paymentMethod"];
  } = {},
): ArcaNoteEmissionSource {
  const invoiceType = overrides.invoiceType ?? "A";
  const environment = overrides.environment ?? "HOMOLOGACION";

  return {
    settingsEnvironment: environment,
    issuerCuit: ISSUER_CUIT,
    issuer: {
      issuerName: "EMISOR",
      issuerCuit: ISSUER_CUIT,
      issuerAddress: "Calle 1",
      issuerCity: "Rosario",
      issuerProvince: "Santa Fe",
      issuerIvaCondition: "Responsable Inscripto",
      issuerGrossIncome: "123",
      issuerActivitiesStartedAt: "2020-01-01",
      pointOfSale: "0012",
    },
    invoice: {
      id: "invoice-1",
      environment,
      fiscalStatus: "AUTORIZADA",
      invoiceType,
      pointOfSale: "0007",
      sequenceNumber: 9,
      issuedAt: new Date("2026-09-30T15:00:00.000Z"),
      cae: ASSOCIATED_CAE,
      ivaPercent: 21,
      totalVisualRoundedCents: 121_000,
      paymentMethod: overrides.paymentMethod ?? "CUENTA_CORRIENTE",
      paymentStatus: "IMPAGA",
      client:
        invoiceType === "A"
          ? {
              id: "client-1",
              code: "CLI-0001",
              name: "CLIENTE A",
              identificationType: "CUIT",
              identificationNumber: CLIENT_CUIT,
              ivaCondition: "RESPONSABLE_INSCRIPTO",
            }
          : {
              id: "client-1",
              code: "CLI-0001",
              name: "CLIENTE B",
              identificationType: "NINGUNO",
              identificationNumber: null,
              ivaCondition: "CONSUMIDOR_FINAL",
            },
    },
    authorizedCreditCents: 0,
    authorizedDebitCents: 0,
    allocatedCents: 0,
  };
}

function noteInput(
  overrides: Partial<IssueArcaNoteInput> = {},
): IssueArcaNoteInput {
  return {
    kind: "CREDIT",
    invoiceId: "invoice-1",
    amountCents: 10_000,
    reason: "Ajuste comercial",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    createdByUserId: "user-1",
    issuedAt: "2026-10-03T15:00:00.000Z",
    ...overrides,
  };
}

function prismaRow(emission: ArcaEmissionRecord): BillingArcaEmission {
  return {
    id: emission.id,
    idempotencyKey: emission.idempotencyKey,
    requestHash: emission.requestHash,
    environment: emission.environment,
    service: emission.service,
    status: emission.status,
    issuerCuit: emission.issuerCuit,
    pointOfSale: emission.pointOfSale,
    invoiceType: emission.invoiceType,
    voucherType: emission.voucherType,
    voucherNumber: emission.voucherNumber,
    fiscalRequestSnapshot: emission.fiscalRequestSnapshot,
    arcaResult: emission.arcaResult,
    authorizationCode: emission.authorizationCode,
    authorizationExpiresAt: emission.authorizationExpiresAt,
    arcaProcessDate: emission.arcaProcessDate,
    reprocess: emission.reprocess,
    observations: emission.observations,
    errors: emission.errors,
    events: emission.events,
    lastErrorCode: emission.lastErrorCode,
    lastErrorMessage: emission.lastErrorMessage,
    billingPayloadSnapshot: emission.billingPayloadSnapshot,
    invoiceId: emission.invoiceId,
    noteId: emission.noteId,
    createdAt: new Date("2026-10-03T15:00:00.000Z"),
    updatedAt: new Date("2026-10-03T15:00:00.000Z"),
  } as BillingArcaEmission;
}

function createHarness(lastNumber = 0) {
  const rows = new Map<string, ArcaEmissionRecord>();
  const fiscalSource = source();
  const settlementUpdates: Array<{
    paymentStatus: string;
    fiscalStatus: string;
  }> = [];
  let sequence = 0;
  let noteSequence = 0;
  let failFinalize = false;
  const lastByType = new Map<number, number>();
  const scopes: string[] = [];
  const tails = new Map<string, Promise<unknown>>();
  const requestCae = vi.fn(async (request: ArcaCaeRequest) => {
    const row = [...rows.values()].find(
      (item) => item.voucherNumber === request.voucherFrom && item.voucherType === request.voucherType,
    );
    expect(row?.status).toBe("SENDING");
    expect(row?.invoiceId).toBeNull();
    expect(row?.noteId).toBeNull();
    lastByType.set(request.voucherType, request.voucherFrom);
    return approved(request.voucherFrom, request.voucherType);
  });
  const getLastAuthorizedVoucher = vi.fn(
    async (input: { pointOfSale: number; voucherType: number }) => ({
      pointOfSale: input.pointOfSale,
      voucherType: input.voucherType,
      lastNumber: lastByType.get(input.voucherType) ?? lastNumber,
      events: [],
    }),
  );
  const reconcile = vi.fn(async () => ({ status: "not_found" as const }));

  const tx = {
    async $queryRaw() {
      return [
        {
          id: "invoice-1",
          fiscalStatus: "AUTORIZADA",
          totalVisualRounded: new Prisma.Decimal("1210.00"),
        },
      ];
    },
    billingInvoice: {
      async findUniqueOrThrow() {
        return {
          paymentMethod: fiscalSource.invoice.paymentMethod,
          fiscalStatus: "AUTORIZADA" as const,
          totalVisualRounded: new Prisma.Decimal("1210.00"),
        };
      },
      async update({ data }: { data: { paymentStatus: string; fiscalStatus: string } }) {
        settlementUpdates.push(data);
        return data;
      },
    },
    billingReceiptAllocation: {
      async aggregate() {
        return { _sum: { amount: null } };
      },
      async findMany() {
        return [];
      },
    },
    billingNote: {
      async aggregate({ where }: { where: { kind: "CREDIT" | "DEBIT" } }) {
        const cents =
          where.kind === "CREDIT"
            ? fiscalSource.authorizedCreditCents
            : fiscalSource.authorizedDebitCents;
        return {
          _sum: {
            amount: cents === 0 ? null : new Prisma.Decimal((cents / 100).toFixed(2)),
          },
        };
      },
      async create({ data }: { data: { kind: "CREDIT" | "DEBIT"; amount: Prisma.Decimal } }) {
        const cents = pesosToCents(data.amount.toNumber());
        if (data.kind === "CREDIT") {
          fiscalSource.authorizedCreditCents += cents;
        } else {
          fiscalSource.authorizedDebitCents += cents;
        }
        noteSequence += 1;
        return { id: `note-${noteSequence}` };
      },
      async findUnique() {
        return null;
      },
    },
    billingArcaEmission: {
      async findUnique({ where }: { where: { id: string } }) {
        const row = rows.get(where.id);
        return row ? prismaRow(row) : null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: "COMPLETED"; noteId: string };
      }) {
        const row = rows.get(where.id);
        if (!row) {
          throw new Error("missing emission");
        }
        const next = { ...row, status: data.status, noteId: data.noteId };
        rows.set(where.id, next);
        return prismaRow(next);
      },
    },
  };

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
        noteId: null,
      };
      rows.set(row.id, row);
      return row;
    },
    async updateSending(id, data) {
      const current = rows.get(id);
      const taken = [...rows.values()].some(
        (row) =>
          row.id !== id &&
          row.environment === current?.environment &&
          row.pointOfSale === current?.pointOfSale &&
          row.voucherType === data.voucherType &&
          row.voucherNumber === data.voucherNumber,
      );
      if (taken) {
        throw new DuplicateArcaVoucherNumberError();
      }
      if (!current) {
        throw new Error("missing");
      }
      const next = {
        ...current,
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
        fiscalRequestSnapshot: data.clearVoucherNumber ? null : row.fiscalRequestSnapshot,
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

  async function finalize(emissionId: string) {
    if (failFinalize) {
      failFinalize = false;
      throw new Error("persistencia local");
    }

    const emission = rows.get(emissionId);
    if (!emission) {
      throw new Error("missing");
    }
    if (emission.status === "COMPLETED" && emission.noteId) {
      return {
        status: "completed" as const,
        emissionId,
        note: {
          id: emission.noteId,
          kind: "CREDIT" as const,
          environment: "HOMOLOGACION" as const,
          fiscalStatus: "AUTORIZADA" as const,
          invoiceType: emission.invoiceType,
          pointOfSale: "0007",
          sequenceNumber: emission.voucherNumber ?? 0,
          noteNumber: `0007-${String(emission.voucherNumber).padStart(8, "0")}`,
          voucherType: emission.voucherType,
          invoiceId: "invoice-1",
          amountCents: 10_000,
          netAmountCents: 0,
          ivaAmountCents: 0,
          cae: emission.authorizationCode ?? "",
          caeExpiresAt: emission.authorizationExpiresAt?.toISOString() ?? "",
          qrUrl: null,
          settlement: null,
        },
      };
    }

    const write = buildApprovedNoteWrite(emission);
    const note = await commitApprovedNote(
      tx as never,
      emissionId,
      write,
    );
    return { status: "completed" as const, emissionId, note };
  }

  function dependencies(current = fiscalSource) {
    return {
      store,
      lock,
      loadSource: async () => current,
      finalize,
      getAccessTicket: async () => ticket(),
      getLastAuthorizedVoucher,
      requestCae,
      reconcile,
    };
  }

  return {
    rows,
    scopes,
    fiscalSource,
    settlementUpdates,
    requestCae,
    getLastAuthorizedVoucher,
    reconcile,
    dependencies,
    failNextFinalize() {
      failFinalize = true;
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("issueArcaNote", () => {
  it.each([
    ["CREDIT", "A", 3, 1],
    ["DEBIT", "A", 2, 1],
    ["CREDIT", "B", 8, 6],
    ["DEBIT", "B", 7, 6],
  ] as const)(
    "emite %s %s con voucherType %s y asocia la factura tipo %s",
    async (kind, invoiceType, voucherType, associatedType) => {
      const harness = createHarness(4);
      Object.assign(harness.fiscalSource, source({ invoiceType }));
      const result = await issueArcaNote(
        noteInput({
          kind,
          amountCents: kind === "CREDIT" ? 10_000 : 5_000,
        }),
        harness.dependencies(),
      );

      expect(result.status).toBe("completed");
      expect(harness.getLastAuthorizedVoucher).toHaveBeenCalledWith(
        expect.objectContaining({ pointOfSale: 7, voucherType }),
      );
      expect(harness.requestCae).toHaveBeenCalledWith(
        expect.objectContaining({
          pointOfSale: 7,
          voucherType,
          voucherFrom: 5,
          voucherTo: 5,
          associatedVouchers: [
            expect.objectContaining({
              type: associatedType,
              pointOfSale: 7,
              number: 9,
              issuerCuit: ISSUER_CUIT,
              issuedAt: "20260930",
            }),
          ],
        }),
      );
      if (result.status !== "completed") {
        throw new Error("La nota no se completó.");
      }
      expect(result.voucherNumber).toBe(5);
      expect(result.noteNumber).toBe("0007-00000005");
      expect(result.fiscalStatus).toBe("AUTORIZADA");
      expect(result.authorizationCode).toBe("12345678901234");
      expect(result.authorizationExpiresAt).toBe("20261010");
      const row = [...harness.rows.values()][0];
      expect(row?.status).toBe("COMPLETED");
      expect(row?.noteId).toBe(result.noteId);
      expect(row?.invoiceId).toBeNull();
      expect(row?.voucherType).toBe(voucherType);
      expect(harness.scopes).toContain(`HOMOLOGACION|7|${voucherType}`);
    },
  );

  it("no duplica la misma clave y rechaza otra intención", async () => {
    const harness = createHarness(0);
    const first = await issueArcaNote(noteInput(), harness.dependencies());
    const second = await issueArcaNote(noteInput(), harness.dependencies());

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    if (first.status === "completed" && second.status === "completed") {
      expect(second.noteId).toBe(first.noteId);
    }
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.rows.size).toBe(1);

    await expect(
      issueArcaNote(noteInput({ reason: "Otro motivo" }), harness.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_IDEMPOTENCY_CONFLICT" });
  });

  it("ante un fallo de persistencia reintenta sin otro CAE", async () => {
    const harness = createHarness(0);
    harness.failNextFinalize();

    await expect(issueArcaNote(noteInput(), harness.dependencies())).rejects.toThrow(
      "persistencia local",
    );
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.status).toBe("APPROVED_PENDING_PERSISTENCE");
    expect([...harness.rows.values()][0]?.voucherNumber).toBe(1);

    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.getLastAuthorizedVoucher).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.voucherNumber).toBe(1);
  });

  it("un rechazo no crea la nota y el reintento no emite otra", async () => {
    const harness = createHarness(0);
    harness.requestCae.mockResolvedValue(rejected(1));
    const result = await issueArcaNote(noteInput(), harness.dependencies());

    expect(result.status).toBe("rejected");
    expect([...harness.rows.values()][0]?.status).toBe("REJECTED");
    expect([...harness.rows.values()][0]?.noteId).toBeNull();

    const again = await issueArcaNote(noteInput(), harness.dependencies());
    expect(again.status).toBe("rejected");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("si la respuesta se pierde consulta el comprobante y no crea la nota hasta confirmarlo", async () => {
    const harness = createHarness(0);
    harness.requestCae.mockRejectedValue(
      new ArcaWsfeError("se perdió la respuesta", "NETWORK_ERROR"),
    );
    const ambiguous = await issueArcaNote(noteInput(), harness.dependencies());

    expect(ambiguous).toMatchObject({ status: "ambiguous", code: "NETWORK_ERROR" });
    expect(harness.reconcile).not.toHaveBeenCalled();
    expect([...harness.rows.values()][0]?.noteId).toBeNull();

    await expect(issueArcaNote(noteInput(), harness.dependencies())).rejects.toMatchObject({
      code: "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND",
    });
    expect(harness.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ voucherType: 3, pointOfSale: 7, voucherNumber: 1 }),
    );
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect([...harness.rows.values()][0]?.noteId).toBeNull();

    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });
    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("no llama a WSFE en producción si el kill switch está cerrado", async () => {
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    const harness = createHarness(0);
    const getAccessTicket = vi.fn();
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));

    await expect(
      issueArcaNote(
        noteInput(),
        {
          ...harness.dependencies(),
          getAccessTicket,
        },
      ),
    ).rejects.toMatchObject({ code: "PRODUCTION_EMISSION_DISABLED" });
    expect(getAccessTicket).not.toHaveBeenCalled();
    expect(harness.getLastAuthorizedVoucher).not.toHaveBeenCalled();
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect(harness.rows.size).toBe(0);
  });

  it("homologación no depende del kill switch de producción", async () => {
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    const harness = createHarness(0);
    const result = await issueArcaNote(noteInput(), harness.dependencies());

    expect(result.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("serializa dos notas del mismo tipo y no deja que la segunda supere el máximo", async () => {
    const harness = createHarness(0);
    const first = issueArcaNote(
      noteInput({
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        amountCents: 80_000,
      }),
      harness.dependencies(),
    );
    const second = issueArcaNote(
      noteInput({
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        amountCents: 80_000,
      }),
      harness.dependencies(),
    );
    const results = await Promise.all([first, second]);
    const completed = results.filter((result) => result.status === "completed");
    const blocked = results.filter((result) => result.status === "failed_pre_send");

    expect(completed).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.fiscalSource.authorizedCreditCents).toBe(80_000);
    const numbers = [...harness.rows.values()]
      .map((row) => row.voucherNumber)
      .filter((value) => value !== null);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("un error antes de enviar no reserva número ni crea nota", async () => {
    const harness = createHarness(0);
    harness.getLastAuthorizedVoucher.mockRejectedValue(
      new ArcaWsfeError("sin ticket", "INVALID_TICKET"),
    );

    const result = await issueArcaNote(noteInput(), harness.dependencies());

    expect(result.status).toBe("failed_pre_send");
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect([...harness.rows.values()][0]?.noteId).toBeNull();
    expect([...harness.rows.values()][0]?.voucherNumber).toBeNull();
  });
});

function blankIssuer(current: ArcaNoteEmissionSource) {
  current.issuerCuit = "";
  current.issuer = {
    issuerName: null,
    issuerCuit: null,
    issuerAddress: null,
    issuerCity: null,
    issuerProvince: null,
    issuerIvaCondition: null,
    issuerGrossIncome: null,
    issuerActivitiesStartedAt: null,
    pointOfSale: null,
  };
}

function storedIssuer(harness: ReturnType<typeof createHarness>) {
  const snapshot = [...harness.rows.values()][0]?.billingPayloadSnapshot;

  if (!snapshot || !("issuerSnapshot" in snapshot)) {
    return null;
  }

  return snapshot.issuerSnapshot;
}

function enableProductionEmission() {
  vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "true");
  vi.stubEnv("ARCA_NOTE_PRODUCTION_EMISSION_ENABLED", "true");
  vi.stubEnv(
    "ARCA_PROD_CERT_B64",
    Buffer.from(
      "-----BEGIN CERTIFICATE-----\nDUMMY-CERT\n-----END CERTIFICATE-----\n",
      "utf8",
    ).toString("base64"),
  );
  vi.stubEnv(
    "ARCA_PROD_PRIVATE_KEY_B64",
    Buffer.from(
      "-----BEGIN PRIVATE KEY-----\nDUMMY-KEY\n-----END PRIVATE KEY-----\n",
      "utf8",
    ).toString("base64"),
  );
}

describe("retry de una emisión ya persistida", () => {
  it("reconoce un PREPARED cuando la configuración después queda incompleta", async () => {
    const harness = createHarness(0);
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    harness.fiscalSource.issuer.issuerAddress = "DOMICILIO ORIGINAL";
    const base = harness.dependencies();
    let blockSending = true;
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        if (blockSending) {
          blockSending = false;
          throw new Error("corte antes de enviar");
        }

        return base.store.updateSending(id, data);
      },
    };

    await expect(issueArcaNote(noteInput(), { ...base, store })).rejects.toThrow(
      "corte antes de enviar",
    );
    blankIssuer(harness.fiscalSource);
    const recovered = await issueArcaNote(noteInput(), { ...base, store });

    expect(recovered.status).toBe("completed");
    expect(harness.rows.size).toBe(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(storedIssuer(harness)).toMatchObject({
      name: "ROTHAMEL ORIGINAL",
      address: "DOMICILIO ORIGINAL",
    });
  });

  it("finaliza una aprobación pendiente sin usar la configuración incompleta", async () => {
    const harness = createHarness(0);
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    harness.failNextFinalize();
    const getAccessTicket = vi.fn(async () => ticket());

    await expect(
      issueArcaNote(noteInput(), { ...harness.dependencies(), getAccessTicket }),
    ).rejects.toThrow("persistencia local");
    blankIssuer(harness.fiscalSource);
    const recovered = await issueArcaNote(noteInput(), {
      ...harness.dependencies(),
      getAccessTicket,
    });

    expect(recovered.status).toBe("completed");
    expect(getAccessTicket).toHaveBeenCalledTimes(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(storedIssuer(harness)?.name).toBe("ROTHAMEL ORIGINAL");
  });

  it("devuelve la misma nota completada aunque la configuración quede incompleta", async () => {
    const harness = createHarness(0);
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    const first = await issueArcaNote(noteInput(), harness.dependencies());
    blankIssuer(harness.fiscalSource);
    const again = await issueArcaNote(noteInput(), harness.dependencies());

    expect(first.status).toBe("completed");
    expect(again.status).toBe("completed");
    if (first.status === "completed" && again.status === "completed") {
      expect(again.noteId).toBe(first.noteId);
    }
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(storedIssuer(harness)?.name).toBe("ROTHAMEL ORIGINAL");
  });

  it("reconcilia una emisión ambigua con la configuración incompleta", async () => {
    const harness = createHarness(0);
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("se perdió la respuesta", "NETWORK_ERROR"),
    );
    const ambiguous = await issueArcaNote(noteInput(), harness.dependencies());

    expect(ambiguous.status).toBe("ambiguous");
    blankIssuer(harness.fiscalSource);
    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });
    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).toHaveBeenCalledTimes(1);
    expect(storedIssuer(harness)?.name).toBe("ROTHAMEL ORIGINAL");
  });

  it("una emisión nueva con configuración incompleta no crea PREPARED", async () => {
    const harness = createHarness(0);
    blankIssuer(harness.fiscalSource);

    await expect(issueArcaNote(noteInput(), harness.dependencies())).rejects.toThrow(
      /configuración fiscal del emisor/,
    );
    expect(harness.rows.size).toBe(0);
    expect(harness.requestCae).not.toHaveBeenCalled();
  });

  it("la misma clave con otro payload sigue en conflicto aunque la configuración esté incompleta", async () => {
    const harness = createHarness(0);
    await issueArcaNote(noteInput(), harness.dependencies());
    blankIssuer(harness.fiscalSource);

    await expect(
      issueArcaNote(noteInput({ reason: "Otro motivo" }), harness.dependencies()),
    ).rejects.toMatchObject({ code: "ARCA_IDEMPOTENCY_CONFLICT" });
    expect(harness.rows.size).toBe(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("no envía un PREPARED de producción si el kill switch se apagó", async () => {
    enableProductionEmission();
    const harness = createHarness(0);
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    const base = harness.dependencies();
    let blockSending = true;
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        if (blockSending) {
          blockSending = false;
          throw new Error("corte antes de enviar");
        }

        return base.store.updateSending(id, data);
      },
    };

    await expect(issueArcaNote(noteInput(), { ...base, store })).rejects.toThrow(
      "corte antes de enviar",
    );
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    blankIssuer(harness.fiscalSource);
    const getAccessTicket = vi.fn();

    await expect(
      issueArcaNote(noteInput(), { ...base, store, getAccessTicket }),
    ).rejects.toMatchObject({ code: "PRODUCTION_EMISSION_DISABLED" });
    expect(getAccessTicket).not.toHaveBeenCalled();
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect([...harness.rows.values()][0]?.status).toBe("PREPARED");
    expect(storedIssuer(harness)?.name).toBe("ROTHAMEL ORIGINAL");
  });

  it("finaliza localmente una aprobación de producción con el kill switch apagado", async () => {
    enableProductionEmission();
    const harness = createHarness(0);
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));
    harness.failNextFinalize();
    const getAccessTicket = vi.fn(async () => ticket());

    await expect(
      issueArcaNote(noteInput(), { ...harness.dependencies(), getAccessTicket }),
    ).rejects.toThrow("persistencia local");
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    blankIssuer(harness.fiscalSource);
    const recovered = await issueArcaNote(noteInput(), {
      ...harness.dependencies(),
      getAccessTicket,
    });

    expect(recovered.status).toBe("completed");
    expect(getAccessTicket).toHaveBeenCalledTimes(1);
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).not.toHaveBeenCalled();
  });

  it("recupera una nota de producción completada con el kill switch apagado", async () => {
    enableProductionEmission();
    const harness = createHarness(0);
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));
    const first = await issueArcaNote(noteInput(), harness.dependencies());
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    blankIssuer(harness.fiscalSource);
    const again = await issueArcaNote(noteInput(), harness.dependencies());

    expect(again.status).toBe("completed");
    if (first.status === "completed" && again.status === "completed") {
      expect(again.noteId).toBe(first.noteId);
    }
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).not.toHaveBeenCalled();
  });

  it("consulta una emisión ambigua de producción sin pedir otro CAE", async () => {
    enableProductionEmission();
    const harness = createHarness(0);
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("se perdió la respuesta", "NETWORK_ERROR"),
    );
    const ambiguous = await issueArcaNote(noteInput(), harness.dependencies());

    expect(ambiguous.status).toBe("ambiguous");
    vi.stubEnv("ARCA_PRODUCTION_EMISSION_ENABLED", "false");
    blankIssuer(harness.fiscalSource);
    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });
    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.getLastAuthorizedVoucher).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).toHaveBeenCalledTimes(1);
    expect(storedIssuer(harness)?.name).toBe("ROTHAMEL ORIGINAL");
  });
});

describe("rollout de notas en producción", () => {
  function productionHarness() {
    enableProductionEmission();
    const harness = createHarness(0);
    Object.assign(harness.fiscalSource, source({ environment: "PRODUCCION" }));
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    return harness;
  }

  function closeNoteRollout() {
    vi.stubEnv("ARCA_NOTE_PRODUCTION_EMISSION_ENABLED", "false");
  }

  it("bloquea una emisión nueva aunque el kill switch global esté abierto", async () => {
    const harness = productionHarness();
    closeNoteRollout();
    const getAccessTicket = vi.fn();

    await expect(
      issueArcaNote(noteInput(), { ...harness.dependencies(), getAccessTicket }),
    ).rejects.toMatchObject({ code: "NOTE_PRODUCTION_EMISSION_DISABLED" });
    expect(getAccessTicket).not.toHaveBeenCalled();
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect(harness.rows.size).toBe(0);
  });

  it("no envía un PREPARED si el rollout de notas se apagó", async () => {
    const harness = productionHarness();
    const base = harness.dependencies();
    let blockSending = true;
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        if (blockSending) {
          blockSending = false;
          throw new Error("corte antes de enviar");
        }

        return base.store.updateSending(id, data);
      },
    };

    await expect(issueArcaNote(noteInput(), { ...base, store })).rejects.toThrow(
      "corte antes de enviar",
    );
    closeNoteRollout();
    const getAccessTicket = vi.fn();

    await expect(
      issueArcaNote(noteInput(), { ...base, store, getAccessTicket }),
    ).rejects.toMatchObject({ code: "NOTE_PRODUCTION_EMISSION_DISABLED" });
    expect(getAccessTicket).not.toHaveBeenCalled();
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect([...harness.rows.values()][0]?.status).toBe("PREPARED");
  });

  it("no reenvía un FAILED_PRE_SEND si el rollout de notas está apagado", async () => {
    const harness = productionHarness();
    const base = harness.dependencies();
    let blockSending = true;
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        if (blockSending) {
          blockSending = false;
          throw new Error("corte antes de enviar");
        }

        return base.store.updateSending(id, data);
      },
    };

    await expect(issueArcaNote(noteInput(), { ...base, store })).rejects.toThrow(
      "corte antes de enviar",
    );
    const prepared = [...harness.rows.values()][0];
    if (prepared) {
      prepared.status = "FAILED_PRE_SEND";
    }
    closeNoteRollout();
    const getAccessTicket = vi.fn();

    await expect(
      issueArcaNote(noteInput(), { ...base, store, getAccessTicket }),
    ).rejects.toMatchObject({ code: "NOTE_PRODUCTION_EMISSION_DISABLED" });
    expect(getAccessTicket).not.toHaveBeenCalled();
    expect(harness.requestCae).not.toHaveBeenCalled();
  });

  it("consulta un SENDING con número aunque el rollout de notas esté apagado", async () => {
    const harness = productionHarness();
    const base = harness.dependencies();
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        await base.store.updateSending(id, data);
        throw new Error("corte después de numerar");
      },
    };

    await expect(issueArcaNote(noteInput(), { ...base, store })).rejects.toThrow(
      "corte después de numerar",
    );
    expect([...harness.rows.values()][0]?.status).toBe("SENDING");
    expect([...harness.rows.values()][0]?.voucherNumber).not.toBeNull();
    closeNoteRollout();
    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });

    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).not.toHaveBeenCalled();
    expect(harness.reconcile).toHaveBeenCalledTimes(1);
  });

  it("consulta una emisión ambigua aunque el rollout de notas esté apagado", async () => {
    const harness = productionHarness();
    harness.requestCae.mockRejectedValueOnce(
      new ArcaWsfeError("se perdió la respuesta", "NETWORK_ERROR"),
    );
    const ambiguous = await issueArcaNote(noteInput(), harness.dependencies());

    expect(ambiguous.status).toBe("ambiguous");
    closeNoteRollout();
    harness.reconcile.mockResolvedValue({
      status: "authorized",
      authorizationCode: "12345678901234",
      expirationDate: "20261010",
      emissionType: "CAE",
      result: "A",
    });
    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).toHaveBeenCalledTimes(1);
  });

  it("finaliza localmente una aprobación pendiente con el rollout de notas apagado", async () => {
    const harness = productionHarness();
    harness.failNextFinalize();
    await expect(issueArcaNote(noteInput(), harness.dependencies())).rejects.toThrow(
      "persistencia local",
    );
    closeNoteRollout();
    const recovered = await issueArcaNote(noteInput(), harness.dependencies());

    expect(recovered.status).toBe("completed");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).not.toHaveBeenCalled();
  });

  it("devuelve la nota completada con el rollout de notas apagado", async () => {
    const harness = productionHarness();
    const first = await issueArcaNote(noteInput(), harness.dependencies());
    closeNoteRollout();
    const again = await issueArcaNote(noteInput(), harness.dependencies());

    expect(again.status).toBe("completed");
    if (first.status === "completed" && again.status === "completed") {
      expect(again.noteId).toBe(first.noteId);
    }
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
  });

  it("devuelve el rechazo existente con el rollout de notas apagado", async () => {
    const harness = productionHarness();
    harness.requestCae.mockResolvedValueOnce(rejected(1));
    const rejectedResult = await issueArcaNote(noteInput(), harness.dependencies());

    expect(rejectedResult.status).toBe("rejected");
    closeNoteRollout();
    const again = await issueArcaNote(noteInput(), harness.dependencies());

    expect(again.status).toBe("rejected");
    expect(harness.requestCae).toHaveBeenCalledTimes(1);
    expect(harness.reconcile).not.toHaveBeenCalled();
  });
});

describe("commitApprovedNote", () => {
  function settlementTx(paymentMethod: "CUENTA_CORRIENTE" | "CONTADO_EFECTIVO" = "CUENTA_CORRIENTE") {
    const calls: string[] = [];
    const updates: Array<{ paymentStatus: string; fiscalStatus: string }> = [];
    const notes: Array<{ kind: "CREDIT" | "DEBIT"; amount: Prisma.Decimal }> = [];
    let completed = false;
    const emission = {
      id: "emission-1",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      requestHash: "hash",
      environment: "HOMOLOGACION",
      service: "wsfe",
      status: "APPROVED_PENDING_PERSISTENCE",
      issuerCuit: ISSUER_CUIT,
      pointOfSale: 7,
      invoiceType: "A",
      voucherType: 3,
      voucherNumber: 1,
      fiscalRequestSnapshot: null,
      arcaResult: "A",
      authorizationCode: "12345678901234",
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
      noteId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as BillingArcaEmission;

    const tx = {
      async $queryRaw() {
        calls.push("lock-invoice");
        return [
          {
            id: "invoice-1",
            fiscalStatus: "AUTORIZADA",
            totalVisualRounded: new Prisma.Decimal("1210.00"),
          },
        ];
      },
      billingInvoice: {
        async findUniqueOrThrow() {
          calls.push("read-invoice");
          return {
            paymentMethod,
            fiscalStatus: "AUTORIZADA" as const,
            totalVisualRounded: new Prisma.Decimal("1210.00"),
          };
        },
        async update({ data }: { data: { paymentStatus: string; fiscalStatus: string } }) {
          calls.push("settlement");
          updates.push(data);
          return data;
        },
      },
      billingReceiptAllocation: {
        async aggregate() {
          return { _sum: { amount: null } };
        },
        async findMany() {
          return [];
        },
      },
      billingNote: {
        async aggregate({ where }: { where: { kind: "CREDIT" | "DEBIT" } }) {
          const total = notes
            .filter((note) => note.kind === where.kind)
            .reduce((sum, note) => sum + note.amount.toNumber(), 0);
          return {
            _sum: { amount: total === 0 ? null : new Prisma.Decimal(total.toFixed(2)) },
          };
        },
        async create({
          data,
        }: {
          data: { kind: "CREDIT" | "DEBIT"; amount: Prisma.Decimal };
        }) {
          calls.push("create");
          notes.push({ kind: data.kind, amount: data.amount });
          return { id: "note-1" };
        },
      },
      billingArcaEmission: {
        async findUnique() {
          return emission;
        },
        async update() {
          calls.push("complete");
          completed = true;
          return { ...emission, status: "COMPLETED", noteId: "note-1" };
        },
      },
    };

    return { tx, calls, updates, completed };
  }

  function write(
    amountCents: number,
    kind: "CREDIT" | "DEBIT" = "CREDIT",
    sequenceNumber = 1,
  ) {
    const net = Math.round((amountCents * 100) / 121);
    return {
      kind,
      environment: "HOMOLOGACION" as const,
      invoiceType: "A" as const,
      pointOfSale: "0007",
      sequenceNumber,
      noteNumber: `0007-${String(sequenceNumber).padStart(8, "0")}`,
      voucherType: kind === "CREDIT" ? 3 : 2,
      issuedAt: new Date("2026-10-03T15:00:00.000Z"),
      invoiceId: "invoice-1",
      clientId: "client-1",
      clientCode: "CLI-0001",
      clientName: "CLIENTE A",
      clientIdentificationType: "CUIT" as const,
      clientIdentificationNumber: CLIENT_CUIT,
      clientIvaCondition: "RESPONSABLE_INSCRIPTO" as const,
      amountCents,
      netAmountCents: net,
      ivaAmountCents: amountCents - net,
      ivaPercent: "21.00",
      reason: "Ajuste",
      cae: "12345678901234",
      caeExpiresAt: new Date("2026-10-10T00:00:00.000Z"),
      createdByUserId: "user-1",
    };
  }

  it("una NC parcial baja el saldo y conserva AUTORIZADA", async () => {
    const { tx, updates, calls } = settlementTx();
    const note = await commitApprovedNote(tx as never, "emission-1", write(10_000));

    expect(calls).toEqual([
      "lock-invoice",
      "create",
      "read-invoice",
      "settlement",
      "complete",
    ]);
    expect(note.fiscalStatus).toBe("AUTORIZADA");
    expect(note.qrUrl).toBeNull();
    expect(note.settlement).toMatchObject({
      fiscalStatus: "AUTORIZADA",
      paymentStatus: "PARCIALMENTE_PAGA",
      outstandingCents: 111_000,
    });
    expect(updates[0]?.fiscalStatus).toBe("AUTORIZADA");
  });

  it("una ND aumenta el saldo y conserva AUTORIZADA", async () => {
    const { tx, updates } = settlementTx();
    const note = await commitApprovedNote(tx as never, "emission-1", write(5_000, "DEBIT"));

    expect(note.settlement?.outstandingCents).toBe(126_000);
    expect(updates[0]).toMatchObject({
      fiscalStatus: "AUTORIZADA",
      paymentStatus: "IMPAGA",
    });
  });

  it("una NC total anula el saldo comercial y conserva la autorización", async () => {
    const { tx, updates } = settlementTx();
    const note = await commitApprovedNote(tx as never, "emission-1", write(121_000));

    expect(note.settlement).toMatchObject({
      fiscalStatus: "AUTORIZADA",
      paymentStatus: "ANULADA",
      outstandingCents: 0,
    });
    expect(updates[0]?.fiscalStatus).toBe("AUTORIZADA");
  });

  it("si el settlement falla no completa la emisión", async () => {
    const { tx, calls, completed } = settlementTx();
    tx.billingInvoice.update = async () => {
      calls.push("settlement");
      throw new Error("settlement");
    };

    await expect(
      commitApprovedNote(tx as never, "emission-1", write(10_000)),
    ).rejects.toThrow("settlement");
    expect(calls.indexOf("lock-invoice")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("lock-invoice")).toBeLessThan(calls.indexOf("create"));
    expect(calls.indexOf("create")).toBeLessThan(calls.indexOf("settlement"));
    expect(calls).not.toContain("complete");
    expect(completed).toBe(false);
  });

  it.each(["CREDIT", "DEBIT"] as const)(
    "NC de $200 y ND de $300 dejan $1.100 cuando el primero es %s",
    async (firstKind) => {
      const notes: Array<{ id: string; kind: "CREDIT" | "DEBIT"; amount: Prisma.Decimal }> = [];
      const seenAtSettlement: Array<{ credit: number; debit: number }> = [];
      const invoiceUpdates: Array<{ paymentStatus: string; fiscalStatus: string }> = [];
      const emissions = new Map<string, BillingArcaEmission>();
      let tail = Promise.resolve();
      let releaseHeld: (() => void) | null = null;
      let notifyFirstLock!: () => void;
      const firstLocked = new Promise<void>((resolve) => {
        notifyFirstLock = resolve;
      });
      let firstLockNotified = false;

      function remember(id: string, voucherType: number, voucherNumber: number) {
        emissions.set(id, {
          id,
          idempotencyKey: id,
          requestHash: "hash",
          environment: "HOMOLOGACION",
          service: "wsfe",
          status: "APPROVED_PENDING_PERSISTENCE",
          issuerCuit: ISSUER_CUIT,
          pointOfSale: 7,
          invoiceType: "A",
          voucherType,
          voucherNumber,
          fiscalRequestSnapshot: null,
          arcaResult: "A",
          authorizationCode: "12345678901234",
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
          noteId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as BillingArcaEmission);
      }

      remember("emission-nc", 3, 1);
      remember("emission-nd", 2, 1);

      const tx = {
        async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
          const sql = Array.from(strings).join("?");
          expect(sql).toContain('FROM "BillingInvoice"');
          expect(sql).toContain("FOR UPDATE");
          expect(values).toEqual(["invoice-1"]);
          expect(sql.includes("invoice-1")).toBe(false);

          let release!: () => void;
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          const previous = tail;
          tail = released;
          await previous;
          releaseHeld = release;
          if (!firstLockNotified) {
            firstLockNotified = true;
            notifyFirstLock();
          }
          return [
            {
              id: "invoice-1",
              fiscalStatus: "AUTORIZADA",
              totalVisualRounded: new Prisma.Decimal("1000.00"),
            },
          ];
        },
        billingInvoice: {
          async findUniqueOrThrow() {
            return {
              paymentMethod: "CUENTA_CORRIENTE" as const,
              fiscalStatus: "AUTORIZADA" as const,
            };
          },
          async update({
            data,
          }: {
            data: { paymentStatus: string; fiscalStatus: string };
          }) {
            invoiceUpdates.push(data);
            seenAtSettlement.push({
              credit: notes
                .filter((note) => note.kind === "CREDIT")
                .reduce((sum, note) => sum + note.amount.toNumber(), 0),
              debit: notes
                .filter((note) => note.kind === "DEBIT")
                .reduce((sum, note) => sum + note.amount.toNumber(), 0),
            });
            return data;
          },
        },
        billingReceiptAllocation: {
          async aggregate() {
            return { _sum: { amount: null } };
          },
          async findMany() {
            return [];
          },
        },
        billingNote: {
          async aggregate({ where }: { where: { kind: "CREDIT" | "DEBIT" } }) {
            const total = notes
              .filter((note) => note.kind === where.kind)
              .reduce((sum, note) => sum + note.amount.toNumber(), 0);
            return {
              _sum: { amount: total === 0 ? null : new Prisma.Decimal(total.toFixed(2)) },
            };
          },
          async create({
            data,
          }: {
            data: { kind: "CREDIT" | "DEBIT"; amount: Prisma.Decimal };
          }) {
            const id = `note-${notes.length + 1}`;
            notes.push({ id, kind: data.kind, amount: data.amount });
            return { id };
          },
        },
        billingArcaEmission: {
          async findUnique({ where }: { where: { id: string } }) {
            return emissions.get(where.id) ?? null;
          },
          async update({
            where,
            data,
          }: {
            where: { id: string };
            data: { status: "COMPLETED"; noteId: string };
          }) {
            const row = emissions.get(where.id);
            if (!row) {
              throw new Error("emisión inexistente");
            }
            const next = { ...row, status: data.status, noteId: data.noteId };
            emissions.set(where.id, next);
            return next;
          },
        },
      };

      async function commitAndUnlock(
        emissionId: string,
        noteWrite: ReturnType<typeof write>,
      ) {
        try {
          return await commitApprovedNote(tx as never, emissionId, noteWrite);
        } finally {
          const release = releaseHeld;
          releaseHeld = null;
          release?.();
        }
      }

      const firstId = firstKind === "CREDIT" ? "emission-nc" : "emission-nd";
      const secondId = firstKind === "CREDIT" ? "emission-nd" : "emission-nc";
      const firstWrite = write(firstKind === "CREDIT" ? 20_000 : 30_000, firstKind, 1);
      const secondKind = firstKind === "CREDIT" ? "DEBIT" : "CREDIT";
      const secondWrite = write(secondKind === "CREDIT" ? 20_000 : 30_000, secondKind, 2);

      const firstPromise = commitAndUnlock(firstId, firstWrite);
      await firstLocked;
      const secondPromise = commitAndUnlock(secondId, secondWrite);
      const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

      expect(seenAtSettlement[0]).toEqual(
        firstKind === "CREDIT" ? { credit: 200, debit: 0 } : { credit: 0, debit: 300 },
      );
      expect(firstResult.settlement?.outstandingCents).toBe(
        firstKind === "CREDIT" ? 80_000 : 130_000,
      );
      expect(secondResult.settlement).toMatchObject({
        fiscalStatus: "AUTORIZADA",
        outstandingCents: 110_000,
      });
      expect(seenAtSettlement[1]).toEqual({ credit: 200, debit: 300 });
      expect(notes.map((note) => note.kind).sort()).toEqual(["CREDIT", "DEBIT"]);
      expect(emissions.get("emission-nc")).toMatchObject({
        status: "COMPLETED",
        invoiceId: null,
      });
      expect(emissions.get("emission-nd")).toMatchObject({
        status: "COMPLETED",
        invoiceId: null,
      });
      expect(emissions.get("emission-nc")?.noteId).toBeTruthy();
      expect(emissions.get("emission-nd")?.noteId).toBeTruthy();
      expect(emissions.get("emission-nc")?.noteId).not.toBe(emissions.get("emission-nd")?.noteId);
      expect(invoiceUpdates.at(-1)?.fiscalStatus).toBe("AUTORIZADA");
    },
  );
});

describe("hashArcaNoteRequest", () => {
  const base = {
      kind: "CREDIT" as const,
      invoiceId: "invoice-1",
      reason: "Ajuste",
      amountCents: 10_000,
      netAmountCents: 8_264,
      ivaAmountCents: 1_736,
      ivaPercent: 21,
      issuedAt: "2026-10-03T15:00:00.000Z",
      client: {
        id: "client-1",
        code: "CLI-0001",
        name: "CLIENTE A",
        identificationType: "CUIT" as const,
        identificationNumber: CLIENT_CUIT,
        ivaCondition: "RESPONSABLE_INSCRIPTO" as const,
      },
      associatedInvoice: {
        environment: "HOMOLOGACION" as const,
        invoiceType: "A" as const,
        pointOfSale: "0007",
        sequenceNumber: 9,
        issuedAt: "2026-09-30T15:00:00.000Z",
        cae: ASSOCIATED_CAE,
        totalVisualRoundedCents: 121_000,
      },
      issuer: {
        issuerName: "ROTHAMEL ORIGINAL",
        issuerCuit: ISSUER_CUIT,
        issuerAddress: "DOMICILIO ORIGINAL",
        issuerCity: "Rosario",
        issuerProvince: "Santa Fe",
        issuerIvaCondition: "Responsable Inscripto",
        issuerGrossIncome: "123",
        issuerActivitiesStartedAt: "2020-01-01",
        pointOfSale: "0007",
      },
    };

  it("un reintento con otro usuario conserva el mismo hash", () => {
    const first = hashArcaNoteRequest({
      issuerCuit: ISSUER_CUIT,
      snapshot: canonicalizeArcaNotePayload({ ...base, createdByUserId: "user-1" }),
    });
    const retry = hashArcaNoteRequest({
      issuerCuit: ISSUER_CUIT,
      snapshot: canonicalizeArcaNotePayload({ ...base, createdByUserId: "user-2" }),
    });

    expect(retry).toBe(first);
  });

  it("el nombre visual del emisor no entra en el hash", () => {
    const renamed = hashArcaNoteRequest({
      issuerCuit: ISSUER_CUIT,
      snapshot: canonicalizeArcaNotePayload({
        ...base,
        createdByUserId: "user-1",
        issuer: { ...base.issuer, issuerName: "ROTHAMEL NUEVO", issuerAddress: "DOMICILIO NUEVO" },
      }),
    });
    const original = hashArcaNoteRequest({
      issuerCuit: ISSUER_CUIT,
      snapshot: canonicalizeArcaNotePayload({ ...base, createdByUserId: "user-1" }),
    });

    expect(renamed).toBe(original);
  });
});

function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamAt = buffer.indexOf("stream", cursor);
    if (streamAt < 0) break;
    let dataStart = streamAt + "stream".length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf("endstream", dataStart);
    if (end < 0) break;
    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
    const slice = buffer.subarray(dataStart, dataEnd);
    try {
      parts.push(inflateSync(slice).toString("latin1"));
    } catch {
      parts.push(slice.toString("latin1"));
    }
    cursor = end + "endstream".length;
  }

  return parts
    .join("\n")
    .replace(/<([0-9A-Fa-f\s]+)>/g, (token, hex: string) => {
      const clean = hex.replace(/\s/g, "");
      if (clean.length === 0 || clean.length % 2 !== 0) return token;
      return Buffer.from(clean, "hex").toString("latin1");
    });
}

describe("issuerSnapshot de la nota", () => {
  it("homologación incompleta no crea la emisión", async () => {
    const harness = createHarness();
    harness.fiscalSource.issuer.issuerAddress = " ";

    await expect(issueArcaNote(noteInput(), harness.dependencies())).rejects.toThrow(
      /configuración fiscal del emisor/,
    );
    expect(harness.rows.size).toBe(0);
  });

  it("congela el emisor del primer intento y el PDF no usa la configuración nueva", async () => {
    const harness = createHarness();
    harness.fiscalSource.issuer.issuerName = "ROTHAMEL ORIGINAL";
    harness.fiscalSource.issuer.issuerAddress = "DOMICILIO ORIGINAL";
    const base = harness.dependencies();
    let blockSending = true;
    const store: ArcaEmissionStore = {
      ...base.store,
      async updateSending(id, data) {
        if (blockSending) {
          blockSending = false;
          throw new Error("corte antes de enviar");
        }
        return base.store.updateSending(id, data);
      },
    };

    await expect(
      issueArcaNote(noteInput(), { ...base, store }),
    ).rejects.toThrow("corte antes de enviar");
    const prepared = [...harness.rows.values()][0];
    expect(prepared?.status).toBe("PREPARED");
    expect(prepared?.billingPayloadSnapshot).toMatchObject({
      documentKind: "NOTE",
      issuerSnapshot: {
        name: "ROTHAMEL ORIGINAL",
        address: "DOMICILIO ORIGINAL",
      },
    });

    harness.fiscalSource.issuer.issuerName = "ROTHAMEL NUEVO";
    harness.fiscalSource.issuer.issuerAddress = "DOMICILIO NUEVO";
    const ambiguous = await issueArcaNote(noteInput(), {
      ...base,
      store,
      requestCae: async () => {
        throw new ArcaWsfeError("timeout", "NETWORK_ERROR");
      },
    });
    expect(ambiguous.status).toBe("ambiguous");
    expect([...harness.rows.values()][0]?.status).toBe("AMBIGUOUS");
    expect(prepared?.billingPayloadSnapshot).toMatchObject({
      issuerSnapshot: {
        name: "ROTHAMEL ORIGINAL",
        address: "DOMICILIO ORIGINAL",
      },
    });

    const completed = await issueArcaNote(noteInput(), {
      ...base,
      store,
      reconcile: async () => ({
        status: "authorized",
        authorizationCode: "12345678901234",
        expirationDate: "20261010",
        emissionType: "CAE",
        result: "A",
      }),
    });
    expect(completed.status).toBe("completed");
    expect(completed.emissionId).toBe(prepared?.id);
    expect(harness.rows.size).toBe(1);
    expect([...harness.rows.values()][0]?.status).toBe("COMPLETED");
    expect(prepared?.billingPayloadSnapshot).toMatchObject({
      issuerSnapshot: {
        name: "ROTHAMEL ORIGINAL",
        address: "DOMICILIO ORIGINAL",
      },
    });

    const snapshot = prepared?.billingPayloadSnapshot;
    if (!snapshot || !("issuerSnapshot" in snapshot)) {
      throw new Error("snapshot");
    }

    const text = pdfText(
      await buildNotePdf({
        kind: "CREDIT",
        noteNumber: completed.status === "completed" ? completed.noteNumber : "",
        invoiceType: "A",
        invoiceNumber: "0007-00000009",
        issuedAt: new Date("2026-10-03T15:00:00.000Z"),
        amount: 100,
        netAmount: 82.64,
        ivaAmount: 17.36,
        ivaPercent: 21,
        reason: "Ajuste comercial",
        clientName: "CLIENTE A",
        clientCode: "CLI-0001",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: CLIENT_CUIT,
        clientIvaCondition: "RESPONSABLE_INSCRIPTO",
        issuer: snapshot.issuerSnapshot,
        logoPng: null,
        environment: "HOMOLOGACION",
        fiscalStatus: "AUTORIZADA",
        pointOfSale: "0007",
        sequenceNumber: completed.status === "completed" ? completed.voucherNumber : 1,
        voucherType: 3,
        cae: "12345678901234",
        caeExpiresAt: new Date(Date.UTC(2026, 9, 10)),
        associatedIssuedAt: new Date("2026-09-30T15:00:00.000Z"),
      }),
    );

    expect(text).toContain("ROTHAMEL ORIGINAL");
    expect(text).toContain("DOMICILIO ORIGINAL");
    expect(text).not.toContain("ROTHAMEL NUEVO");
    expect(text).not.toContain("DOMICILIO NUEVO");
  });

  it("un snapshot de nota sin emisor no parsea y una factura histórica sigue parseando", () => {
    const note = canonicalizeArcaNotePayload({
      kind: "CREDIT",
      invoiceId: "invoice-1",
      reason: "Ajuste",
      amountCents: 10_000,
      netAmountCents: 8_264,
      ivaAmountCents: 1_736,
      ivaPercent: 21,
      createdByUserId: "user-1",
      issuedAt: "2026-10-03T15:00:00.000Z",
      client: {
        id: "client-1",
        code: "CLI-0001",
        name: "CLIENTE A",
        identificationType: "CUIT",
        identificationNumber: CLIENT_CUIT,
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      },
      associatedInvoice: {
        environment: "HOMOLOGACION",
        invoiceType: "A",
        pointOfSale: "0007",
        sequenceNumber: 9,
        issuedAt: "2026-09-30T15:00:00.000Z",
        cae: ASSOCIATED_CAE,
        totalVisualRoundedCents: 121_000,
      },
      issuer: {
        issuerName: "ROTHAMEL ORIGINAL",
        issuerCuit: ISSUER_CUIT,
        issuerAddress: "DOMICILIO ORIGINAL",
        issuerCity: "Rosario",
        issuerProvince: "Santa Fe",
        issuerIvaCondition: "Responsable Inscripto",
        issuerGrossIncome: "123",
        issuerActivitiesStartedAt: "2020-01-01",
        pointOfSale: "0007",
      },
    });
    const { issuerSnapshot: _issuer, ...withoutIssuer } = note;
    expect(parseArcaNoteBillingSnapshot(withoutIssuer)).toBeNull();
    expect(parseArcaNoteBillingSnapshot(note)?.issuerSnapshot.name).toBe("ROTHAMEL ORIGINAL");

    const invoice = canonicalizeBillingPayload({
      issuedAt: "2026-09-30T15:00:00.000Z",
      pointOfSale: 7,
      invoiceType: "A",
      client: {
        id: "client-1",
        code: "CLI-0001",
        name: "CLIENTE FACTURA",
        identificationType: "CUIT",
        identificationNumber: CLIENT_CUIT,
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      },
      items: [
        {
          rubroCode: "RUB-0001",
          rubroName: "FILTROS",
          description: "Filtro",
          quantity: 1,
          unitPriceCents: 121_000,
          lineTotalCents: 121_000,
          sortOrder: 0,
        },
      ],
      financial: {
        subtotalCents: 121_000,
        discountPercent: 0,
        discountAmountCents: 0,
        ivaPercent: 21,
        ivaAmountCents: 21_000,
        totalCents: 121_000,
        totalVisualRoundedCents: 121_000,
        netCents: 100_000,
        nonTaxedCents: 0,
        exemptCents: 0,
        taxCents: 0,
      },
      paymentMethod: "CONTADO",
      paymentStatus: "PAGA",
    });

    expect(parseBillingPayloadSnapshot(invoice)?.client.name).toBe("CLIENTE FACTURA");
    expect(parseArcaNoteBillingSnapshot(invoice)).toBeNull();
  });
});
