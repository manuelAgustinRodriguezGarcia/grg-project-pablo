import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertHomoCreditNoteArgs,
  assertHomoCreditNoteInvoice,
  CREDIT_NOTE_EXECUTE_BLOCKED,
  describeHomoCreditNoteDryRun,
  parseHomoCreditNoteArgs,
  type HomoCreditNoteInvoice,
} from "../../../scripts/arca-homo-test-credit-note-plan";

const CLIENT_CUIT = "30500010912";
const ISSUER_CUIT = "30712345671";
const CAE = "71234567890123";
const KEY = "22222222-2222-4222-8222-222222222222";

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
    executeBloqueado: boolean;
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

describe("execute bloqueado", () => {
  it("aborta aunque estén la confirmación y la UUID", () => {
    expect(() =>
      assertHomoCreditNoteArgs(
        parseHomoCreditNoteArgs([
          "--execute",
          "--confirm-homologacion",
          "--invoice-id=inv-homo",
          `--idempotency-key=${KEY}`,
        ]),
      ),
    ).toThrow(CREDIT_NOTE_EXECUTE_BLOCKED);
  });

  it("el script no importa el motor ni WSFE", () => {
    const source = readFileSync("scripts/arca-homo-test-credit-note.ts", "utf8");

    expect(source).not.toContain("issueArcaNote");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getValidArcaAccessTicket");
    expect(source).not.toContain("getOrCreate");
    expect(source).toContain("assertHomoCreditNoteArgs");
  });
});
