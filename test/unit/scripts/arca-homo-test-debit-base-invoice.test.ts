import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { assertCommercialLimits } from "@/server/arca/notes/issue-arca-note";
import {
  DEBIT_BASE_CLIENT_ID,
  DEBIT_BASE_DESCRIPTION,
  DEBIT_BASE_EXECUTE_BLOCKED,
  DebitBaseAbort,
  assertCashInvoiceRejectsDebit,
  assertDebitBaseAcceptsNote,
  assertDebitBaseArgs,
  buildDebitBaseIntention,
  describeDebitBaseDryRun,
  parseDebitBaseArgs,
  type DebitBaseClient,
} from "../../../scripts/arca-homo-test-debit-base-invoice-plan";

const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";

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
      executeBloqueado: boolean;
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

describe("execute bloqueado", () => {
  it("aborta aunque estén la confirmación, el cliente y la UUID", () => {
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          "--confirm-homologacion",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
          "--idempotency-key=44444444-4444-4444-8444-444444444444",
        ]),
      ),
    ).toThrow(DEBIT_BASE_EXECUTE_BLOCKED);
    expect(() =>
      assertDebitBaseArgs(
        parseDebitBaseArgs([
          "--execute",
          "--confirm-homologacion",
          `--client-id=${DEBIT_BASE_CLIENT_ID}`,
          "--idempotency-key=44444444-4444-4444-8444-444444444444",
        ]),
      ),
    ).toThrow(DebitBaseAbort);
  });

  it("el script no llama al motor ni a WSFE", () => {
    const source = readFileSync("scripts/arca-homo-test-debit-base-invoice.ts", "utf8");
    const contado = readFileSync("scripts/arca-homo-test-invoice-plan.ts", "utf8");

    expect(source).not.toContain("issueArcaInvoice");
    expect(source).not.toContain("issueArcaNote");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getValidArcaAccessTicket");
    expect(source).not.toContain("getOrCreate");
    expect(source).not.toContain("ARCA_PROD_");
    expect(source).not.toContain("ARCA_NOTE_PRODUCTION_EMISSION_ENABLED");
    expect(contado).toContain('const paymentMethod = "CONTADO"');
  });
});
