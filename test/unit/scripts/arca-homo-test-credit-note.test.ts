import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));
import { toHomologationHarnessSource } from "@/server/arca/notes/note-emission-source";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import {
  assertHomoCredentialNamesPresent,
  assertHomoCreditNoteArgs,
  assertHomoCreditNoteInvoice,
  describeHomoCreditNoteDryRun,
  executeHomoCreditNote,
  formatHomoCreditNoteVerify,
  HOMO_CREDIT_NOTE_INVOICE_ID,
  parseHomoCreditNoteArgs,
  SAME_KEY_RETRY_MESSAGE,
  type HomoCreditNoteInvoice,
  type HomoCreditNoteVerifyView,
} from "../../../scripts/arca-homo-test-credit-note-plan";

const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";
const CAE = "71234567890123";
const KEY = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function invoice(
  overrides: Partial<HomoCreditNoteInvoice> = {},
): HomoCreditNoteInvoice {
  return {
    id: "inv-homo",
    invoiceNumber: "0007-00000001",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 1,
    issuedAt: new Date("2026-10-05T03:00:00.000Z"),
    cae: CAE,
    ivaPercent: 21,
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    ...overrides,
  };
}

function dryRun(overrides: Partial<HomoCreditNoteInvoice> = {}) {
  return describeHomoCreditNoteDryRun({
    invoice: invoice(overrides),
    issuerCuit: ISSUER_CUIT,
    settingsEnvironment: "PRODUCCION",
    settingsUpdatedAt: "2026-10-02T15:03:21.436Z",
  }) as {
    nota: { kind: string; voucherType: number; amount: string; net: string; iva: string };
    associatedVoucher: { type: number; pointOfSale: number; number: number };
    requestValido: boolean;
    wsaa: number;
    wsfe: number;
    fecaesolicitar: number;
    escriturasDb: number;
    executeRequiereConfirmacion: boolean;
  };
}

describe("factura asociada", () => {
  it("aborta si la factura no existe", () => {
    expect(() => assertHomoCreditNoteInvoice(null)).toThrow(/no encontrada/);
  });

  it("aborta una factura de PRODUCCION", () => {
    expect(() =>
      assertHomoCreditNoteInvoice(invoice({ environment: "PRODUCCION" })),
    ).toThrow(/HOMOLOGACION/);
  });

  it("aborta una factura no autorizada", () => {
    expect(() =>
      assertHomoCreditNoteInvoice(invoice({ fiscalStatus: "RECHAZADA" })),
    ).toThrow(/autorizada/);
  });

  it("aborta una factura sin CAE", () => {
    expect(() => assertHomoCreditNoteInvoice(invoice({ cae: null }))).toThrow(/CAE/);
    expect(() => assertHomoCreditNoteInvoice(invoice({ cae: "  " }))).toThrow(/CAE/);
  });

  it("aborta una Factura B", () => {
    expect(() => assertHomoCreditNoteInvoice(invoice({ invoiceType: "B" }))).toThrow(
      /Factura A/,
    );
  });
});

describe("request de la NC A", () => {
  it("arma crédito A tipo 3 asociado a la factura 1 del punto de venta 7", () => {
    const summary = dryRun();

    expect(summary.nota.kind).toBe("CREDIT");
    expect(summary.nota.voucherType).toBe(3);
    expect(summary.nota.amount).toBe("121.00");
    expect(summary.nota.net).toBe("100.00");
    expect(summary.nota.iva).toBe("21.00");
    expect(summary.associatedVoucher.type).toBe(1);
    expect(summary.associatedVoucher.pointOfSale).toBe(7);
    expect(summary.associatedVoucher.number).toBe(1);
    expect(summary.requestValido).toBe(true);
  });

  it("el dry-run no llama WSAA ni WSFE y no imprime secretos", () => {
    const summary = dryRun();
    const text = JSON.stringify(summary);

    expect(summary.wsaa).toBe(0);
    expect(summary.wsfe).toBe(0);
    expect(summary.fecaesolicitar).toBe(0);
    expect(summary.escriturasDb).toBe(0);
    expect(text).not.toContain(CAE);
    expect(text).not.toContain(CLIENT_CUIT);
    expect(text).not.toContain(ISSUER_CUIT);
    expect(text).not.toContain("BEGIN CERTIFICATE");
  });
});

function executeArgs(extra: string[] = []) {
  return parseHomoCreditNoteArgs([
    "--execute",
    "--confirm-homologacion",
    `--invoice-id=${HOMO_CREDIT_NOTE_INVOICE_ID}`,
    `--idempotency-key=${KEY}`,
    `--created-by-user-id=${USER_ID}`,
    ...extra,
  ]);
}

describe("argumentos de execute", () => {
  it("aborta sin confirmación", () => {
    expect(() =>
      assertHomoCreditNoteArgs(
        parseHomoCreditNoteArgs([
          "--execute",
          `--invoice-id=${HOMO_CREDIT_NOTE_INVOICE_ID}`,
          `--idempotency-key=${KEY}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/confirm-homologacion/);
  });

  it("aborta sin UUID", () => {
    expect(() =>
      assertHomoCreditNoteArgs(
        parseHomoCreditNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_CREDIT_NOTE_INVOICE_ID}`,
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/idempotency-key/);
  });

  it("aborta con una UUID inválida", () => {
    expect(() =>
      assertHomoCreditNoteArgs(
        parseHomoCreditNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_CREDIT_NOTE_INVOICE_ID}`,
          "--idempotency-key=no-es-uuid",
          `--created-by-user-id=${USER_ID}`,
        ]),
      ),
    ).toThrow(/UUID/);
  });

  it("acepta los cuatro flags y el usuario", () => {
    expect(() => assertHomoCreditNoteArgs(executeArgs())).not.toThrow();
  });
});

describe("execute del harness", () => {
  it("cada ejecución llama a issueArcaNote una vez y el retry conserva la UUID", async () => {
    const keys: string[] = [];
    const issueArcaNote = async (
      request: {
        idempotencyKey: string;
        kind: string;
        amountCents: number;
        reason: string;
      },
      options: { loadSource?: (invoiceId: string) => Promise<ArcaNoteEmissionSource | null> },
    ) => {
      keys.push(request.idempotencyKey);
      const source = await options.loadSource?.("factura");
      expect(source?.settingsEnvironment).toBe("HOMOLOGACION");
      expect(request.kind).toBe("CREDIT");
      expect(request.amountCents).toBe(12_100);
      expect(request.reason).toBe("PRUEBA HOMOLOGACION NC");
      expect(request).not.toHaveProperty("voucherNumber");
      return {
        status: "ambiguous" as const,
        emissionId: "em-1",
        voucherType: 3,
        voucherNumber: null,
        code: "TIMEOUT",
      };
    };

    const first = await executeHomoCreditNote(
      {
        invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
        associatedInvoiceNumber: "0007-00000001",
      },
      {
        issueArcaNote,
        loadSource: async () => homologationSource(),
      },
    );
    const second = await executeHomoCreditNote(
      {
        invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
        associatedInvoiceNumber: "0007-00000001",
      },
      {
        issueArcaNote,
        loadSource: async () => homologationSource(),
      },
    );

    expect(keys).toEqual([KEY, KEY]);
    expect(first.text).toContain(SAME_KEY_RETRY_MESSAGE);
    expect(second.text).toContain(`IDEMPOTENCY KEY: ${KEY}`);
    expect(first.text).toContain("voucherType: 3");
    expect(first.text).not.toContain(CAE);
  });

  it("no imprime el CAE ni credenciales", async () => {
    const report = await executeHomoCreditNote(
      {
        invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
        associatedInvoiceNumber: "0007-00000001",
      },
      {
        issueArcaNote: async () => ({
          status: "completed",
          emissionId: "em-1",
          noteId: "note-1",
          noteNumber: "0007-00000001",
          voucherType: 3,
          voucherNumber: 4,
          authorizationCode: CAE,
          authorizationExpiresAt: "2026-10-15",
          fiscalStatus: "AUTORIZADA",
          outstandingCents: 108_900,
        }),
        loadSource: async () => homologationSource(),
      },
    );
    const rejected = await executeHomoCreditNote(
      {
        invoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
        idempotencyKey: KEY,
        createdByUserId: USER_ID,
        associatedInvoiceNumber: "0007-00000001",
      },
      {
        issueArcaNote: async () => ({
          status: "rejected",
          emissionId: "em-2",
          voucherType: 3,
          voucherNumber: 4,
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
    expect(report.text).toContain("voucherType: 3");
    expect(report.text).toContain("CAE PRESENTE: true");
    expect(report.text).toContain("amount: 121.00");
    expect(report.text).not.toContain(CAE);
    expect(rejected.text).not.toContain("BEGIN CERTIFICATE");
    expect(rejected.text).not.toContain("30712345671");
    expect(rejected.text).toContain("[redactado]");
  });
});

describe("loader de homologación", () => {
  it("devuelve HOMOLOGACION aunque la configuración persistida sea PRODUCCION", () => {
    const source = toHomologationHarnessSource({
      ...homologationSource(),
      settingsEnvironment: "PRODUCCION",
    });

    expect(source.settingsEnvironment).toBe("HOMOLOGACION");
    expect(source.issuer.issuerName).toBe("EMISOR HOMO");
    expect(source.invoice.environment).toBe("HOMOLOGACION");
  });

  it("aborta una factura de PRODUCCION", () => {
    expect(() =>
      toHomologationHarnessSource({
        ...homologationSource(),
        invoice: { ...homologationSource().invoice, environment: "PRODUCCION" },
      }),
    ).toThrow(/HOMOLOGACION/);
  });
});

describe("verify y el camino normal", () => {
  it("el script de verify no llama requestCae y el output no lleva CAE", () => {
    const script = readFileSync("scripts/arca-homo-test-credit-note.ts", "utf8");
    const text = formatHomoCreditNoteVerify(verifyView());

    expect(script).toContain("issueArcaNote");
    expect(script).toContain("loadHomologationNoteEmissionSource");
    expect(script).not.toContain("requestCae");
    expect(script).not.toContain("FECAESolicitar");
    expect(script).not.toContain("getOrCreate");
    expect(script).not.toContain("generateNotePdf");
    expect(text).toContain("voucherType: 3");
    expect(text).toContain("CAE PRESENTE: true");
    expect(text).not.toContain(CAE);
    expect(text).toContain("coherente: si");
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

    expect(() => assertHomoCredentialNamesPresent(env)).not.toThrow();
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
      id: HOMO_CREDIT_NOTE_INVOICE_ID,
      environment: "HOMOLOGACION",
      fiscalStatus: "AUTORIZADA",
      invoiceType: "A",
      pointOfSale: "0007",
      sequenceNumber: 1,
      issuedAt: new Date("2026-10-05T03:00:00.000Z"),
      cae: CAE,
      ivaPercent: 21,
      totalVisualRoundedCents: 121_000,
      paymentMethod: "CONTADO",
      paymentStatus: "PAGA",
      client: {
        id: "client-1",
        code: "1",
        name: "Cliente",
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

function verifyView(): HomoCreditNoteVerifyView {
  return {
    emissionStatus: "COMPLETED",
    emissionEnvironment: "HOMOLOGACION",
    voucherType: 3,
    voucherNumber: 4,
    noteId: "note-1",
    noteNumber: "0007-00000004",
    noteKind: "CREDIT",
    noteFiscalStatus: "AUTORIZADA",
    noteEnvironment: "HOMOLOGACION",
    noteInvoiceId: HOMO_CREDIT_NOTE_INVOICE_ID,
    noteVoucherType: 3,
    noteAmountCents: 12_100,
    caePresent: true,
    invoiceFiscalStatus: "AUTORIZADA",
    invoiceNoteCount: 1,
    outstandingCents: 108_900,
    saldoReflejaNc: true,
    lastAuthorizedType3: 4,
    consultResult: "A",
    consultCaePresent: true,
    consultVoucherNumber: 4,
  };
}
