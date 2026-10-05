import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

import type { FinalizeApprovedResult } from "@/server/arca/invoices/finalize-approved-arca-emission";
import type { IssueArcaInvoiceResult } from "@/server/arca/invoices/issue-arca-invoice";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { assertCommercialLimits } from "@/server/arca/notes/issue-arca-note";
import { scopeInvoicesForFiscalEnvironment } from "@/server/services/billing-fiscal-scope";
import {
  DEBIT_BASE_CLIENT_ID,
  DEBIT_BASE_DESCRIPTION,
  DebitBaseAbort,
  SAME_KEY_RETRY_MESSAGE,
  assertCashInvoiceRejectsDebit,
  assertDebitBaseAcceptsNote,
  assertDebitBaseArgs,
  assertDebitBaseCredentialNamesPresent,
  assertDebitBaseExecuteGuards,
  assertDebitBaseProductionIsolation,
  buildDebitBaseIntention,
  describeDebitBaseDryRun,
  executeDebitBaseInvoice,
  formatDebitBaseVerify,
  parseDebitBaseArgs,
  toIssueArcaInvoiceInput,
  type DebitBaseClient,
  type DebitBaseVerifyView,
} from "../../../scripts/arca-homo-test-debit-base-invoice-plan";

const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";
const KEY = "44444444-4444-4444-8444-444444444444";
const CAE = "71234567890123";

function client(): DebitBaseClient {
  return {
    id: DEBIT_BASE_CLIENT_ID,
    code: "1",
    name: "Cliente Factura A",
    address: null,
    city: null,
    province: null,
    email: null,
    whatsapp: null,
    identificationType: "CUIT",
    identificationNumber: CLIENT_CUIT,
    ivaCondition: "RESPONSABLE_INSCRIPTO",
  };
}

function intention() {
  return buildDebitBaseIntention({
    client: client(),
    settings: {
      pointOfSale: "0007",
      issuerCuit: ISSUER_CUIT,
      genericClientLimit: { toNumber: () => 400_000 },
    },
    issuedAt: new Date("2026-10-05T12:00:00.000Z"),
  });
}

describe("factura base para ND", () => {
  it("usa cuenta corriente y sigue siendo Factura A de homologación", () => {
    const built = intention();

    expect(built.environment).toBe("HOMOLOGACION");
    expect(built.invoiceType).toBe("A");
    expect(built.voucherType).toBe(1);
    expect(built.pointOfSale).toBe(7);
    expect(built.paymentMethod).toBe("CUENTA_CORRIENTE");
    expect(built.paymentStatus).toBe("IMPAGA");
    expect(built.totals.netCents).toBe(100_000);
    expect(built.totals.ivaCents).toBe(21_000);
    expect(built.totals.totalCents).toBe(121_000);
  });

  it("deja un request fiscal y un snapshot comercial válidos con el cliente real", () => {
    const built = intention();
    const summary = describeDebitBaseDryRun({
      intention: built,
      issuerCuit: ISSUER_CUIT,
      pointOfSaleText: "0007",
      settingsEnvironment: "PRODUCCION",
      settingsUpdatedAt: "2026-10-02T15:03:21.436Z",
      previousCashRejected: true,
    }) as {
      factura: {
        requestFiscalValido: boolean;
        commercialSnapshotValido: boolean;
        clientId: string;
        paymentMethod: string;
        voucherNumberEsFiscal: boolean;
      };
      wsaa: number;
      wsfe: number;
      escriturasDb: number;
      executeRequiereConfirmacion: boolean;
    };
    const text = JSON.stringify(summary);

    expect(summary.factura.requestFiscalValido).toBe(true);
    expect(summary.factura.commercialSnapshotValido).toBe(true);
    expect(summary.factura.clientId).toBe(DEBIT_BASE_CLIENT_ID);
    expect(built.billing.client.id).toBe(DEBIT_BASE_CLIENT_ID);
    expect(built.billing.items[0]?.rubroId).toBeNull();
    expect(built.billing.items[0]?.description).toBe(DEBIT_BASE_DESCRIPTION);
    expect(summary.factura.paymentMethod).toBe("CUENTA_CORRIENTE");
    expect(summary.factura.voucherNumberEsFiscal).toBe(false);
    expect(summary.wsaa).toBe(0);
    expect(summary.wsfe).toBe(0);
    expect(summary.escriturasDb).toBe(0);
    expect(summary.executeRequiereConfirmacion).toBe(true);
    expect(text).not.toContain(CLIENT_CUIT);
    expect(text).not.toContain(ISSUER_CUIT);
  });
});

describe("nota de débito futura", () => {
  it("resuelve tipo 2 asociado a la factura simulada y cierra 60.50", () => {
    const summary = describeDebitBaseDryRun({
      intention: intention(),
      issuerCuit: ISSUER_CUIT,
      pointOfSaleText: "0007",
      settingsEnvironment: "PRODUCCION",
      settingsUpdatedAt: "2026-10-02T15:03:21.436Z",
      previousCashRejected: true,
    }) as {
      notaDebitoFutura: {
        kind: string;
        voucherType: number;
        importe: string;
        neto: string;
        iva: string;
        reglaComercialAcepta: boolean;
        associatedVoucher: { type: number; pointOfSale: number; number: number };
      };
      saldoEsperado: { cobrable: string };
    };

    expect(summary.notaDebitoFutura.kind).toBe("DEBIT");
    expect(summary.notaDebitoFutura.voucherType).toBe(2);
    expect(summary.notaDebitoFutura.associatedVoucher.type).toBe(1);
    expect(summary.notaDebitoFutura.associatedVoucher.pointOfSale).toBe(7);
    expect(summary.notaDebitoFutura.importe).toBe("60.50");
    expect(summary.notaDebitoFutura.neto).toBe("50.00");
    expect(summary.notaDebitoFutura.iva).toBe("10.50");
    expect(summary.notaDebitoFutura.reglaComercialAcepta).toBe(true);
    expect(summary.saldoEsperado.cobrable).toBe("1270.50");
    expect(summary.notaDebitoFutura.associatedVoucher.number).not.toBe(1);
  });

  it("la cuenta corriente acepta el débito y la factura de contado lo rechaza", () => {
    expect(() => assertDebitBaseAcceptsNote(client())).not.toThrow();
    expect(() => assertCashInvoiceRejectsDebit(client(), "PAGA")).not.toThrow();
    expect(() =>
      assertCommercialLimits(
        {
          settingsEnvironment: "HOMOLOGACION",
          issuerCuit: ISSUER_CUIT,
          issuer: {
            issuerName: null,
            issuerCuit: null,
            issuerAddress: null,
            issuerCity: null,
            issuerProvince: null,
            issuerIvaCondition: null,
            issuerGrossIncome: null,
            issuerActivitiesStartedAt: null,
            pointOfSale: "0007",
          },
          invoice: {
            id: "factura-contado",
            environment: "HOMOLOGACION",
            fiscalStatus: "AUTORIZADA",
            invoiceType: "A",
            pointOfSale: "0007",
            sequenceNumber: 1,
            issuedAt: new Date("2026-10-05T12:00:00.000Z"),
            cae: "presente",
            ivaPercent: 21,
            totalVisualRoundedCents: 121_000,
            paymentMethod: "CONTADO",
            paymentStatus: "PAGA",
            client: {
              id: DEBIT_BASE_CLIENT_ID,
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
        },
        "DEBIT",
        6_050,
      ),
    ).toThrow(BillingInvoiceError);
  });
});

function approvedInvoice(): FinalizeApprovedResult["invoice"] {
  return {
    id: "inv-homo-nd",
    environment: "HOMOLOGACION",
    fiscalStatus: "AUTORIZADA",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 2,
    invoiceNumber: "0007-00000002",
    issuedAt: "2026-10-05T12:00:00.000Z",
    clientId: DEBIT_BASE_CLIENT_ID,
    clientCode: "1",
    clientName: "Cliente Factura A",
    clientAddress: null,
    clientCity: null,
    clientProvince: null,
    clientEmail: null,
    clientWhatsapp: null,
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotalCents: 100_000,
    discountPercent: "0.00",
    discountAmountCents: 0,
    ivaPercent: "21.00",
    ivaAmountCents: 21_000,
    totalCents: 121_000,
    totalVisualRoundedCents: 121_000,
    paymentMethod: "CUENTA_CORRIENTE",
    paymentStatus: "IMPAGA",
    notes: null,
    cae: CAE,
    caeExpiresAt: "2026-10-15T00:00:00.000Z",
    qrUrl: null,
    items: [],
  };
}

function approvedResult(): IssueArcaInvoiceResult {
  return {
    status: "approved",
    emissionId: "em-nd",
    voucherType: 1,
    voucherNumber: 2,
    authorizationCode: CAE,
    authorizationExpiresAt: "2026-10-15T00:00:00.000Z",
  };
}

function verifyView(): DebitBaseVerifyView {
  return {
    emissionStatus: "COMPLETED",
    environment: "HOMOLOGACION",
    voucherType: 1,
    voucherNumber: 2,
    invoiceId: "inv-homo-nd",
    invoiceNumber: "0007-00000002",
    invoiceType: "A",
    pointOfSale: "0007",
    sequenceNumber: 2,
    paymentMethod: "CUENTA_CORRIENTE",
    paymentStatus: "IMPAGA",
    fiscalStatus: "AUTORIZADA",
    caePresent: true,
    outstandingCents: 121_000,
    lastAuthorizedType1: 2,
    consultResult: "A",
    consultCaePresent: true,
    consultVoucherNumber: 2,
    settingsEnvironment: "PRODUCCION",
    isolationConfirmed: true,
  };
}

describe("execute", () => {
  it("aborta sin confirmación, sin UUID o con UUID inválida", () => {
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
          `--idempotency-key=${KEY}`,
        ]),
      ),
    ).toThrow(/confirm-homologacion/);
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          "--confirm-homologacion",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
        ]),
      ),
    ).toThrow(/idempotency-key/);
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          "--confirm-homologacion",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
          "--idempotency-key=no-es-uuid",
        ]),
      ),
    ).toThrow(/UUID/);
  });

  it("acepta los cuatro argumentos obligatorios", () => {
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          "--confirm-homologacion",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
          `--idempotency-key=${KEY}`,
        ]),
      ),
    ).not.toThrow();
  });

  it("aborta ambiente, letra, tipo o forma de pago distintos", () => {
    const built = intention();

    expect(() =>
      assertDebitBaseExecuteGuards({ ...built, environment: "PRODUCCION" }),
    ).toThrow(/HOMOLOGACION/);
    expect(() =>
      assertDebitBaseExecuteGuards({ ...built, invoiceType: "B" }),
    ).toThrow(/no es A/);
    expect(() =>
      assertDebitBaseExecuteGuards({ ...built, voucherType: 6 }),
    ).toThrow(/voucherType/);
    expect(() =>
      assertDebitBaseExecuteGuards({ ...built, paymentMethod: "CONTADO" }),
    ).toThrow(/cuenta corriente/);
  });

  it("llama a issueArcaInvoice una sola vez y deja la factura impaga", async () => {
    const built = intention();
    const issueArcaInvoice = vi.fn(async () => approvedResult());
    const finalizeApprovedArcaEmission = vi.fn(async () => ({
      status: "completed" as const,
      emissionId: "em-nd",
      invoice: approvedInvoice(),
    }));
    const input = toIssueArcaInvoiceInput(built, KEY, ISSUER_CUIT);
    const report = await executeDebitBaseInvoice(built, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission,
    });

    expect(input).not.toHaveProperty("voucherNumber");
    expect(input.environment).toBe("HOMOLOGACION");
    expect(input.invoiceType).toBe("A");
    expect(issueArcaInvoice).toHaveBeenCalledTimes(1);
    expect(issueArcaInvoice.mock.calls[0]?.[0].idempotencyKey).toBe(KEY);
    expect(report.text).toContain("STATUS: COMPLETED");
    expect(report.text).toContain("paymentMethod: CUENTA_CORRIENTE");
    expect(report.text).toContain("paymentStatus: IMPAGA");
    expect(report.text).toContain("outstanding: 1210.00");
    expect(report.text).toContain("CAE PRESENTE: true");
    expect(report.text).not.toContain(CAE);
  });

  it("un retry conserva la misma idempotencyKey", async () => {
    const built = intention();
    const issueArcaInvoice = vi.fn(async () => approvedResult());
    const finalizeApprovedArcaEmission = vi.fn(async () => ({
      status: "completed" as const,
      emissionId: "em-nd",
      invoice: approvedInvoice(),
    }));

    await executeDebitBaseInvoice(built, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission,
    });
    await executeDebitBaseInvoice(built, KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission,
    });

    expect(issueArcaInvoice).toHaveBeenCalledTimes(2);
    expect(issueArcaInvoice.mock.calls[0]?.[0].idempotencyKey).toBe(KEY);
    expect(issueArcaInvoice.mock.calls[1]?.[0].idempotencyKey).toBe(KEY);
  });

  it("AMBIGUOUS pide reejecutar la misma key", async () => {
    const issueArcaInvoice = vi.fn(
      async (): Promise<IssueArcaInvoiceResult> => ({
        status: "ambiguous",
        emissionId: "em-nd",
        voucherType: 1,
        voucherNumber: null,
        code: "TIMEOUT",
      }),
    );
    const report = await executeDebitBaseInvoice(intention(), KEY, ISSUER_CUIT, {
      issueArcaInvoice,
      finalizeApprovedArcaEmission: vi.fn(),
    });

    expect(report.exitCode).toBe(2);
    expect(report.text).toContain("STATUS: AMBIGUOUS");
    expect(report.text).toContain(`IDEMPOTENCY KEY: ${KEY}`);
    expect(report.text).toContain(SAME_KEY_RETRY_MESSAGE);
  });
});

describe("verify", () => {
  it("no imprime el CAE y exige saldo 121000", () => {
    const text = formatDebitBaseVerify(verifyView(), CAE);

    expect(text).toContain("STATUS: VERIFY");
    expect(text).toContain("paymentStatus: IMPAGA");
    expect(text).toContain("outstandingCents: 121000");
    expect(text).toContain("FECompConsultar resultado: A");
    expect(text).toContain("CAE PRESENTE: true");
    expect(text).not.toContain(CAE);
    expect(() =>
      formatDebitBaseVerify({ ...verifyView(), outstandingCents: 0 }, CAE),
    ).toThrow(DebitBaseAbort);
  });

  it("el alcance productivo deja afuera la factura de homologación", () => {
    const scoped = scopeInvoicesForFiscalEnvironment(
      [
        { id: "prod", environment: "PRODUCCION" as const, billingNotes: [] },
        { id: "inv-homo-nd", environment: "HOMOLOGACION" as const, billingNotes: [] },
      ],
      "PRODUCCION",
    );

    expect(scoped.map((row) => row.id)).toEqual(["prod"]);
    expect(() =>
      assertDebitBaseProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: "inv-homo-nd",
        invoiceNumber: "0007-00000002",
        activeInvoiceIds: scoped.map((row) => row.id),
        dashboardInvoiceIds: ["prod"],
        debtorSourceInvoiceIds: scoped.map((row) => row.id),
        movementInvoiceIds: [],
        libroNumbers: ["0007-00000001"],
      }),
    ).not.toThrow();
    expect(() =>
      assertDebitBaseProductionIsolation({
        activeEnvironment: "PRODUCCION",
        invoiceId: "inv-homo-nd",
        invoiceNumber: "0007-00000002",
        activeInvoiceIds: ["inv-homo-nd"],
        dashboardInvoiceIds: [],
        debtorSourceInvoiceIds: [],
        movementInvoiceIds: [],
        libroNumbers: [],
      }),
    ).toThrow(/alcance productivo/);
  });

  it("el script no llama requestCae ni emite la nota", () => {
    const source = readFileSync("scripts/arca-homo-test-debit-base-invoice.ts", "utf8");
    const contado = readFileSync("scripts/arca-homo-test-invoice-plan.ts", "utf8");

    expect(source).toContain("issueArcaInvoice");
    expect(source).toContain('args.mode === "dry-run"');
    expect(source).not.toContain("issueArcaNote");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getOrCreate");
    expect(source).not.toContain("ARCA_PROD_");
    expect(source).not.toContain("ARCA_NOTE_PRODUCTION_EMISSION_ENABLED");
    expect(source).not.toContain("FECAESolicitar");
    expect(contado).toContain('const paymentMethod = "CONTADO"');
  });

  it("solo lee los nombres de credenciales de homologación", () => {
    const reads: string[] = [];
    const env = new Proxy({} as Record<string, string | undefined>, {
      get(_target, property) {
        const name = String(property);
        reads.push(name);
        if (name.includes("PROD")) {
          throw new Error("produccion");
        }

        if (
          name === "ARCA_HOMO_CERT_B64" ||
          name === "ARCA_HOMO_PRIVATE_KEY_B64" ||
          name === "ARCA_TICKET_ENCRYPTION_KEY_B64"
        ) {
          return "presente";
        }

        return undefined;
      },
    });

    expect(() => assertDebitBaseCredentialNamesPresent(env)).not.toThrow();
    expect(reads.some((name) => name.includes("PROD"))).toBe(false);
  });
});
