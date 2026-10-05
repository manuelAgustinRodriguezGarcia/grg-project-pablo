import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

import {
  HOMO_DEBIT_NOTE_CASH_INVOICE_ID,
  HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER,
  HOMO_DEBIT_NOTE_EXECUTE_BLOCKED,
  HOMO_DEBIT_NOTE_INVOICE_ID,
  HomoDebitNoteAbort,
  assertCashInvoiceRejectsDebit,
  assertDebitNoteAdministrator,
  assertHomoDebitNoteArgs,
  assertHomoDebitNoteInvoice,
  describeHomoDebitNoteDryRun,
  parseHomoDebitNoteArgs,
  selectDebitBaseInvoice,
  type DebitBaseCandidate,
  type HomoDebitNoteInvoice,
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
    executeBloqueado: boolean;
  };
}

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
  it("resuelve tipo 2 asociado al sequenceNumber de la factura", () => {
    const real = summaryFor(invoice());
    const otroNumero = summaryFor(invoice({ sequenceNumber: 8 }));

    expect(real.nota.kind).toBe("DEBIT");
    expect(real.nota.voucherType).toBe(2);
    expect(real.nota.amount).toBe("60.50");
    expect(real.nota.net).toBe("50.00");
    expect(real.nota.iva).toBe("10.50");
    expect(real.associatedVoucher.type).toBe(1);
    expect(real.associatedVoucher.pointOfSale).toBe(7);
    expect(real.associatedVoucher.number).toBe(2);
    expect(otroNumero.associatedVoucher.number).toBe(8);
    expect(real.associatedVoucher.issuedAt).toBe(otroNumero.associatedVoucher.issuedAt);
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

describe("execute bloqueado", () => {
  it("aborta aunque estén la confirmación, la factura y las UUID", () => {
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          "--idempotency-key=55555555-5555-4555-8555-555555555555",
          "--created-by-user-id=61eda0d7-31f2-451c-880d-fe47e5384385",
        ]),
      ),
    ).toThrow(HOMO_DEBIT_NOTE_EXECUTE_BLOCKED);
    expect(() =>
      assertHomoDebitNoteArgs(
        parseHomoDebitNoteArgs([
          "--execute",
          "--confirm-homologacion",
          `--invoice-id=${HOMO_DEBIT_NOTE_INVOICE_ID}`,
          "--idempotency-key=55555555-5555-4555-8555-555555555555",
          "--created-by-user-id=61eda0d7-31f2-451c-880d-fe47e5384385",
        ]),
      ),
    ).toThrow(HomoDebitNoteAbort);
  });

  it("exige un administrador activo cuando el execute se habilite", () => {
    expect(() =>
      assertDebitNoteAdministrator({ role: "ADMINISTRADOR", status: "ACTIVE" }),
    ).not.toThrow();
    expect(() => assertDebitNoteAdministrator({ role: "ADMINISTRADOR", status: "DISABLED" })).toThrow(
      /administrador/,
    );
  });

  it("el script no abre WSAA ni WSFE", () => {
    const source = readFileSync("scripts/arca-homo-test-debit-note.ts", "utf8");

    expect(source).toContain("installNetworkGuard");
    expect(source).not.toContain("issueArcaNote");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getValidArcaAccessTicket");
    expect(source).not.toContain("getLastAuthorizedVoucher");
    expect(source).not.toContain("consultVoucher");
    expect(source).not.toContain("getOrCreate");
    expect(source).not.toContain("ARCA_PROD_");
    expect(source).not.toContain("FECAESolicitar");
  });
});
