import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

import { toHomologationHarnessSource } from "@/server/arca/notes/note-emission-source";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import {
  HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
  HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
  HOMO_DEBIT_NOTE_INVOICE_ID,
  SAME_KEY_RETRY_MESSAGE,
  assertCashInvoiceRejectsDebit,
  assertDebitNoteAdministrator,
  assertHomoDebitCredentialNamesPresent,
  assertHomoDebitNoteArgs,
  assertHomoDebitNoteInvoice,
  assertHomoDebitNoteProductionIsolation,
  describeHomoDebitNoteDryRun,
  executeHomoDebitNote,
  formatHomoDebitNoteVerify,
  parseHomoDebitNoteArgs,
  selectDebitBaseInvoice,
  type DebitBaseCandidate,
  type HomoDebitNoteInvoice,
  type HomoDebitNoteVerifyView,
} from "../../../scripts/arca-homo-test-debit-note-plan";

const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";
const CAE = "71234567890123";

function candidate(overrides: Partial<DebitBaseCandidate> = {}): DebitBaseCandidate {
  return {
    id: HOMO_DEBIT_NOTE_INVOICE_ID,
    invoiceNumber: "0007-00000002",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    paymentMethod: "CUENTA_CORRIENTE",
    totalCents: 121_000,
    caePresent: true,
    ...overrides,
  };
}

function invoice(overrides: Partial<HomoDebitNoteInvoice> = {}): HomoDebitNoteInvoice {
  return {
    id: HOMO_DEBIT_NOTE_INVOICE_ID,
    invoiceNumber: "0007-00000002",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 2,
    issuedAt: new Date("2026-10-05T12:35:53.775Z"),
    cae: CAE,
    ivaPercent: 21,
    paymentMethod: "CUENTA_CORRIENTE",
    paymentStatus: "IMPAGA",
    totalCents: 121_000,
    outstandingCents: 121_000,
    client: {
      id: "cmurf5jgy00038cf0f4r2m3ov",
      code: "1",
      name: "Cliente Factura A",
      identificationType: "CUIT",
      identificationNumber: CLIENT_CUIT,
      ivaCondition: "RESPONSABLE_INSCRIPTO",
    },
    ...overrides,
  };
}

function summaryFor(row: HomoDebitNoteInvoice) {
  return describeHomoDebitNoteDryRun({
    invoice: row,
    issuerCuit: ISSUER_CUIT,
    settingsEnvironment: "PRODUCCION",
    settingsUpdatedAt: "2026-10-02T15:03:21.436Z",
    cashRejected: true,
  }) as {
    nota: { kind: string; voucherType: number; amount: string; net: string; iva: string };
    associatedVoucher: { type: number; pointOfSale: number; number: number; issuedAt: string };
    saldoEsperado: {
      outstandingCents: number;
      fiscalStatus: string;
      paymentStatus: string;
    };
    wsaa: number;
    wsfe: number;
    escriturasDb: number;
    executeRequiereConfirmacion: boolean;
  };
}

const KEY = "55555555-5555-4555-8555-555555555555";
const USER_ID = "61eda0d7-31f2-451c-880d-fe47e5384385";

describe("factura base", () => {
  it("elige la segunda factura y excluye la de contado", () => {
    const selected = selectDebitBaseInvoice([
      candidate({
        id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
        invoiceNumber: HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
        paymentMethod: "CUENTA_CORRIENTE",
      }),
      candidate(),
    ]);

    expect(selected.id).toBe(HOMO_DEBIT_NOTE_INVOICE_ID);
    expect(selected.invoiceNumber).not.toBe(HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER);
  });

  it("aborta si la única fila es la factura de contado", () => {
    expect(() =>
      selectDebitBaseInvoice([
        candidate({
          id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
          invoiceNumber: HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
          paymentMethod: "CUENTA_CORRIENTE",
        }),
      ]),
    ).toThrow(/0 facturas candidatas/);
  });

  it("aborta producción, falta de autorización, falta de CAE y contado", () => {
    expect(() => assertHomoDebitNoteInvoice(invoice({ environment: "PRODUCCION" }))).toThrow(
      /HOMOLOGACION/,
    );
    expect(() => assertHomoDebitNoteInvoice(invoice({ fiscalStatus: "MODO_PRUEBA" }))).toThrow(
      /autorizada/,
    );
    expect(() => assertHomoDebitNoteInvoice(invoice({ cae: null }))).toThrow(/CAE/);
    expect(() => assertHomoDebitNoteInvoice(invoice({ paymentMethod: "CONTADO" }))).toThrow(
      /cuenta corriente/,
    );
    expect(() =>
      assertHomoDebitNoteInvoice(
        invoice({
          id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
          invoiceNumber: HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
        }),
      ),
    ).toThrow(/0007-00000001/);
  });
});

describe("nota de débito", () => {
  it("resuelve tipo 2 asociado al sequenceNumber 2 de la factura", () => {
    const real = summaryFor(invoice());

    expect(real.nota.kind).toBe("DEBIT");
    expect(real.nota.voucherType).toBe(2);
    expect(real.nota.amount).toBe("60.50");
    expect(real.nota.net).toBe("50.00");
    expect(real.nota.iva).toBe("10.50");
    expect(real.associatedVoucher.type).toBe(1);
    expect(real.associatedVoucher.pointOfSale).toBe(7);
    expect(real.associatedVoucher.number).toBe(2);
    expect(real.associatedVoucher.number).toBe(invoice().sequenceNumber);
    expect(real.executeRequiereConfirmacion).toBe(true);
    expect(() => summaryFor(invoice({ sequenceNumber: 8 }))).toThrow(/sequenceNumber 2/);
  });

  it("la regla comercial acepta la cuenta corriente y rechaza el contado", () => {
    expect(() => summaryFor(invoice())).not.toThrow();
    expect(summaryFor(invoice()).nota).toMatchObject({ kind: "DEBIT", voucherType: 2 });
    expect(() =>
      assertCashInvoiceRejectsDebit(
        invoice({
          id: HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
          invoiceNumber: HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
          paymentMethod: "CONTADO",
          paymentStatus: "PAGA",
        }),
      ),
    ).not.toThrow();
  });

  it("proyecta saldo 127050 y mantiene la factura autorizada", () => {
    const summary = summaryFor(invoice());
    const text = JSON.stringify(summary);

    expect(summary.saldoEsperado.outstandingCents).toBe(127_050);
    expect(summary.saldoEsperado.fiscalStatus).toBe("AUTORIZADA");
    expect(summary.saldoEsperado.paymentStatus).toBe("IMPAGA");
    expect(summary.wsaa).toBe(0);
    expect(summary.wsfe).toBe(0);
    expect(summary.escriturasDb).toBe(0);
    expect(text).not.toContain(CAE);
    expect(text).not.toContain(CLIENT_CUIT);
    expect(text).not.toContain(ISSUER_CUIT);
  });
});

function executeArgs(extra: string[] = []) {
  return parseHomoDebitNoteArgs([
    "--execute",
    "--confirm-homologacion",
    `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
    `--idempotency-key=${KEY}`,
    `--created-by-user-id=${USER_ID}`,
    ...extra,
  ]);
}

describe("argumentos de execute", () => {
  it("aborta sin confirmación, sin UUID, con UUID inválida o con otra factura", () => {
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          `--idempotency-key=${KEY}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/confirm-homologacion/);
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/idempotency-key/);
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          "--idempotency-key=no-es-uuid",
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/UUID/);
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          `--idempotency-key=${KEY}`,
          "--created-by-user-id=no-es-uuid",
        ]),
      ),
    ).toThrow(/UUID/);
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          "--invoice-id=otra-factura",
          `--idempotency-key=${KEY}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/segunda Factura A/);
    expect(() => parseHomoDebitNoteArgs(["--execute", "--environment=PRODUCCION"])).toThrow(
      /PRODUCCION/,
    );
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_CASH_INVOICE_ID}`,
          `--idempotency-key=${KEY}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/0007-00000001/);
    expect(() => assertHomoDebitNoteArgs(executeArgs())).not.toThrow();
  });

  it("exige un administrador activo", () => {
    expect(() =>
      assertDebitNoteAdministrator({ role: "ADMINISTRADOR", status: "ACTIVE" }),
    ).not.toThrow();
    expect(() => assertDebitNoteAdministrator(null)).toThrow(/administrador/);
    expect(() => assertDebitNoteAdministrator({ role: "ADMINISTRADOR", status: "DISABLED" })).toThrow(
      /administrador/,
    );
  });
});

describe("execute del harness", () => {
  it("llama a issueArcaNote una vez, con débito de 60.50, y el retry conserva la UUID", async () => {
    const calls: Array<{ idempotencyKey: string; kind: string; amountCents: number }> = [];
    const issueArcaNote = async (
      request: {
        idempotencyKey: string;
        kind: "DEBIT";
        amountCents: number;
        reason: string;
        invoiceId: string;
      },
      options: { loadSource?: (invoiceId: string) => Promise<ArcaNoteEmissionSource | null> },
    ) => {
      calls.push(request);
      const source = await options.loadSource?.(request.invoiceId);
      expect(source?.settingsEnvironment).toBe("HOMOLOGACION");
      expect(source?.invoice.environment).toBe("HOMOLOGACION");
      expect(request.kind).toBe("DEBIT");
      expect(request.amountCents).toBe(6_050);
      expect(request.reason).toBe("PRUEBA HOMOLOGACION ND");
      expect(request.invoiceId).toBe(HOMO_DEBIT_NOTE_INVOICE_ID);
      expect(request).not.toHaveProperty("voucherNumber");
      expect(JSON.stringify(request)).not.toContain("900002");
      return {
        status: "ambiguous" as const,
        emissionId: "em-1",
        voucherType: 2,
        voucherNumber: null,
        code: "TIMEOUT",
      };
    };
    const loadSource = async () =>
      toHomologationHarnessSource({
        ...homologationSource(),
        settingsEnvironment: "PRODUCCION",
      });

    const first = await executeHomoDebitNote(
      {
        invoice: invoice(),
        issuerCuit: ISSUER_CUIT,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
      },
      { issueArcaNote, loadSource },
    );
    const second = await executeHomoDebitNote(
      {
        invoice: invoice(),
        issuerCuit: ISSUER_CUIT,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
      },
      { issueArcaNote, loadSource },
    );

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.idempotencyKey)).toEqual([KEY, KEY]);
    expect(first.text).toContain("STATUS: AMBIGUOUS");
    expect(first.text).toContain("voucherType: 2");
    expect(first.text).toContain(SAME_KEY_RETRY_MESSAGE);
    expect(second.text).toContain(`IDEMPOTENCY KEY: ${KEY}`);
    expect(first.text).not.toContain(CAE);
  });

  it("no emite si la factura es de contado", async () => {
    const issueArcaNote = vi.fn();

    await expect(
      executeHomoDebitNote(
        {
          invoice: invoice({ paymentMethod: "CONTADO", paymentStatus: "PAGA" }),
          issuerCuit: ISSUER_CUIT,
          idempotencyKey: KEY,
          createdByUserId: USER_ID,
        },
        { issueArcaNote, loadSource: async () => homologationSource() },
      ),
    ).rejects.toThrow(/cuenta corriente/);
    expect(issueArcaNote).not.toHaveBeenCalled();
  });

  it("imprime el débito autorizado sin CAE ni credenciales", async () => {
    const report = await executeHomoDebitNote(
      {
        invoice: invoice(),
        issuerCuit: ISSUER_CUIT,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
      },
      {
        issueArcaNote: async () => ({
          status: "completed",
          emissionId: "em-1",
          noteId: "note-1",
          noteNumber: "0007-00000003",
          voucherType: 2,
          voucherNumber: 5,
          authorizationCode: CAE,
          authorizationExpiresAt: "2026-10-15",
          fiscalStatus: "AUTORIZADA",
          outstandingCents: 127_050,
        }),
        loadSource: async () => homologationSource(),
      },
    );
    const rejected = await executeHomoDebitNote(
      {
        invoice: invoice(),
        issuerCuit: ISSUER_CUIT,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
      },
      {
        issueArcaNote: async () => ({
          status: "rejected",
          emissionId: "em-2",
          voucherType: 2,
          voucherNumber: 5,
        }),
        loadSource: async () => homologationSource(),
        readRejection: async () => [
          {
            code: "10016",
            message: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE----- 30712345671",
          },
        ],
      },
    );

    expect(report.text).toContain("STATUS: COMPLETED");
    expect(report.text).toContain("kind: DEBIT");
    expect(report.text).toContain("voucherType: 2");
    expect(report.text).toContain("sequenceNumber: 5");
    expect(report.text).toContain("amount: 60.50");
    expect(report.text).toContain("invoice outstanding: 1270.50");
    expect(report.text).toContain("invoice outstanding cents: 127050");
    expect(report.text).toContain("fiscalStatus: AUTORIZADA");
    expect(report.text).toContain("CAE PRESENTE: true");
    expect(report.text).not.toContain(CAE);
    expect(report.text).not.toContain(ISSUER_CUIT);
    expect(rejected.text).toContain("STATUS: REJECTED");
    expect(rejected.text).toContain(`IDEMPOTENCY KEY: ${KEY}`);
    expect(rejected.text).not.toContain("BEGIN CERTIFICATE");
    expect(rejected.text).not.toContain("30712345671");
    expect(rejected.text).toContain("[redactado]");
  });
});

describe("verify y el camino normal", () => {
  it("verify no llama requestCae y exige saldo 127050", () => {
    const script = readFileSync("scripts/arca-homo-test-debit-note.ts", "utf8");
    const text = formatHomoDebitNoteVerify(verifyView(), CAE);

    expect(script).toContain("issueArcaNote");
    expect(script).toContain("loadHomologationNoteEmissionSource");
    expect(script).toContain('args.mode === "dry-run" ? installNetworkGuard()');
    expect(script).not.toContain("requestCae");
    expect(script).not.toContain("FECAESolicitar");
    expect(script).not.toContain("getOrCreate");
    expect(script).not.toContain("randomUUID");
    expect(script).not.toContain("ARCA_PROD_");
    expect(text).toContain("voucherType: 2");
    expect(text).toContain("outstandingCents: 127050");
    expect(text).toContain("CAE PRESENTE: true");
    expect(text).toContain("coherente: si");
    expect(text).not.toContain(CAE);
    expect(() => formatHomoDebitNoteVerify({ ...verifyView(), outstandingCents: 121_000 })).toThrow(
      /no cerró/,
    );
  });

  it("la UI sigue usando el loader normal", () => {
    const action = readFileSync(
      "src/features/billing/actions/issue-billing-note.action.ts",
      "utf8",
    );
    const motor = readFileSync("src/server/arca/notes/issue-arca-note.ts", "utf8");
    const loader = readFileSync("src/server/arca/notes/note-emission-source.ts", "utf8");

    expect(action).toContain("issueArcaNote({");
    expect(action).not.toContain("loadSource");
    expect(action).not.toContain("loadHomologationNoteEmissionSource");
    expect(motor).toContain("loadArcaNoteEmissionSource");
    expect(motor).not.toContain("loadHomologationNoteEmissionSource");
    expect(loader).toContain("billingFiscalSettingsRepository.getOrCreate()");
    expect(loader).toContain("settingsEnvironment: settings.environment");
  });

  it("aísla la factura y la nota mientras la configuración sigue en producción", () => {
    expect(() =>
      assertHomoDebitNoteProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
        invoiceNumber: "0007-00000002",
        noteId: "note-1",
        noteNumber: "0007-00000003",
        activeInvoiceIds: [],
        productionNoteIds: [],
        dashboardInvoiceIds: [],
        debtorSourceInvoiceIds: [],
        movementIds: [],
        movementInvoiceIds: [],
        libroInvoiceIds: [],
        libroNoteIds: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertHomoDebitNoteProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
        invoiceNumber: "0007-00000002",
        noteId: "note-1",
        noteNumber: "0007-00000001",
        activeInvoiceIds: [],
        productionNoteIds: [],
        dashboardInvoiceIds: [],
        debtorSourceInvoiceIds: [],
        movementIds: [],
        movementInvoiceIds: [],
        libroInvoiceIds: ["factura-produccion"],
        libroNoteIds: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertHomoDebitNoteProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
        invoiceNumber: "0007-00000002",
        noteId: "note-1",
        noteNumber: "0007-00000003",
        activeInvoiceIds: [],
        productionNoteIds: ["note-1"],
        dashboardInvoiceIds: [],
        debtorSourceInvoiceIds: [],
        movementIds: [],
        movementInvoiceIds: [],
        libroInvoiceIds: [],
        libroNoteIds: [],
      }),
    ).toThrow(/alcance productivo/);
    expect(() =>
      assertHomoDebitNoteProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
        invoiceNumber: "0007-00000002",
        noteId: "cmuv9agjm00013cf0g0ohdvny",
        noteNumber: "0007-00000001",
        activeInvoiceIds: [],
        productionNoteIds: [],
        dashboardInvoiceIds: [],
        debtorSourceInvoiceIds: [],
        movementIds: [],
        movementInvoiceIds: [],
        libroInvoiceIds: [],
        libroNoteIds: ["cmuv9agjm00013cf0g0ohdvny"],
      }),
    ).toThrow(/alcance productivo/);
  });

  it("las credenciales se leen solo por nombre de homologación", () => {
    const env = new Proxy(
      {
        ARCA_HOMO_CERT_B64: "cert",
        ARCA_HOMO_PRIVATE_KEY_B64: "key",
        ARCA_TICKET_ENCRYPTION_KEY_B64: "ticket",
      } as Record<string, string | undefined>,
      {
        get(target, property) {
          const name = String(property);
          if (name.startsWith("ARCA_PROD_")) {
            throw new Error("credencial de producción");
          }

          return target[name];
        },
      },
    );

    expect(() => assertHomoDebitCredentialNamesPresent(env)).not.toThrow();
  });
});

function homologationSource(): ArcaNoteEmissionSource {
  return {
    settingsEnvironment: "HOMOLOGACION",
    issuerCuit: ISSUER_CUIT,
    issuer: {
      issuerName: "EMISOR HOMO",
      issuerCuit: ISSUER_CUIT,
      issuerAddress: "Calle 1",
      issuerCity: "Ciudad",
      issuerProvince: "Buenos Aires",
      issuerIvaCondition: "Responsable inscripto",
      issuerGrossIncome: "IIBB",
      issuerActivitiesStartedAt: "01/01/2020",
      pointOfSale: "0007",
    },
    invoice: {
      id: HOMO_DEBIT_NOTE_INVOICE_ID,
      environment: "HOMOLOGACION",
      fiscalStatus: "AUTORIZADA",
      invoiceType: "A",
      pointOfSale: "0007",
      sequenceNumber: 2,
      issuedAt: new Date("2026-10-05T12:35:53.775Z"),
      cae: CAE,
      ivaPercent: 21,
      totalVisualRoundedCents: 121_000,
      paymentMethod: "CUENTA_CORRIENTE",
      paymentStatus: "IMPAGA",
      client: {
        id: "cmurf5jgy00038cf0f4r2m3ov",
        code: "1",
        name: "Cliente Factura A",
        identificationType: "CUIT",
        identificationNumber: CLIENT_CUIT,
        ivaCondition: "RESPONSABLE_INSCRIPTO",
      },
    },
    authorizedCreditCents: 0,
    authorizedDebitCents: 0,
    allocatedCents: 0,
  };
}

function verifyView(): HomoDebitNoteVerifyView {
  return {
    emissionStatus: "COMPLETED",
    emissionEnvironment: "HOMOLOGACION",
    voucherType: 2,
    voucherNumber: 5,
    noteId: "note-1",
    noteNumber: "0007-00000003",
    noteKind: "DEBIT",
    noteFiscalStatus: "AUTORIZADA",
    noteEnvironment: "HOMOLOGACION",
    noteInvoiceId: HOMO_DEBIT_NOTE_INVOICE_ID,
    noteVoucherType: 2,
    noteAmountCents: 6_050,
    caePresent: true,
    invoiceNumber: "0007-00000002",
    invoiceFiscalStatus: "AUTORIZADA",
    invoicePaymentMethod: "CUENTA_CORRIENTE",
    invoicePaymentStatus: "IMPAGA",
    invoiceNoteCount: 1,
    outstandingCents: 127_050,
    lastAuthorizedType2: 5,
    consultResult: "A",
    consultCaePresent: true,
    consultVoucherNumber: 5,
    settingsEnvironment: "PRODUCCION",
    isolationConfirmed: true,
  };
}
