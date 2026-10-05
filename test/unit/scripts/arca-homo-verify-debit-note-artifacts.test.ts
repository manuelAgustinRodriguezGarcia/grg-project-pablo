import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  LibroIvaInvoiceSource,
  LibroIvaNoteSource,
} from "@/features/billing/utils/libro-iva";
import {
  HOMO_DEBIT_ARTIFACT_INVOICE_ID,
  HOMO_DEBIT_ARTIFACT_NOTE_ID,
  assertCreditAndDebitCoexist,
  assertDebitNoteBalance,
  assertDebitNotePdfText,
  assertProductionIsolationById,
  assessDebitHomologationLibro,
  formatDebitQrVerification,
} from "../../../scripts/arca-homo-verify-debit-note-artifacts-plan";

const CAE = "71234567890123";
const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";

function invoiceSource(
  overrides: Partial<LibroIvaInvoiceSource> = {},
): LibroIvaInvoiceSource {
  return {
    issuedAt: new Date("2026-10-05T12:00:00.000Z"),
    invoiceType: "A",
    pointOfSale: "0007",
    invoiceNumber: "0007-00000001",
    clientName: "Cliente",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotal: 1000,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 210,
    total: 1210,
    totalVisualRounded: 1210,
    ...overrides,
  };
}

function noteSource(overrides: Partial<LibroIvaNoteSource> = {}): LibroIvaNoteSource {
  return {
    kind: "CREDIT",
    issuedAt: new Date("2026-10-05T15:00:00.000Z"),
    invoiceType: "A",
    pointOfSale: "0007",
    noteNumber: "0007-00000001",
    invoiceNumber: "0007-00000001",
    clientName: "Cliente",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: CLIENT_CUIT,
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    netAmount: 100,
    ivaPercent: 21,
    ivaAmount: 21,
    amount: 121,
    ...overrides,
  };
}

function fourDocuments() {
  return {
    invoices: [
      invoiceSource(),
      invoiceSource({ invoiceNumber: "0007-00000002" }),
    ],
    notes: [
      noteSource(),
      noteSource({
        kind: "DEBIT",
        invoiceNumber: "0007-00000002",
        netAmount: 50,
        ivaAmount: 10.5,
        amount: 60.5,
      }),
    ],
  };
}

describe("PDF y QR de la ND", () => {
  it("exige el texto fiscal de la nota de débito sin imprimir el CAE", () => {
    const report = assertDebitNotePdfText({
      text: [
        "NOTA DE DÉBITO",
        "A",
        "COD. 002",
        "0007-00000001",
        "HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN",
        "CAE:",
        CAE,
        "Vto. CAE: 15/10/2026",
        "Comprobante asociado",
        "Factura A 0007-00000002",
        "$60,50",
        "Neto $50,00",
        "IVA 21% $10,50",
        "PRUEBA HOMOLOGACION ND",
        "EMISOR HOMO",
        "Cliente Factura A",
      ].join("\n"),
      cae: CAE,
      expiration: "15/10/2026",
      issuerName: "EMISOR HOMO",
      clientName: "Cliente Factura A",
      amountLabel: "$60,50",
      netLabel: "Neto $50,00",
      ivaLabel: "IVA 21% $10,50",
    });

    expect(report).toContain("COD. 002: sí");
    expect(report).toContain("importe $60,50: sí");
    expect(report).not.toContain(CAE);
  });

  it("acepta el QR tipo 2 de 60.50 y oculta el CAE", () => {
    const report = formatDebitQrVerification({
      ver: 1,
      fecha: "2026-10-05",
      cuit: Number(ISSUER_CUIT),
      ptoVta: 7,
      tipoCmp: 2,
      nroCmp: 1,
      importe: 60.5,
      moneda: "PES",
      ctz: 1,
      tipoCodAut: "E",
      codAut: Number(CAE),
      tipoDocRec: 80,
      nroDocRec: Number(CLIENT_CUIT),
      expectedFecha: "2026-10-05",
      expectedCaeDigits: CAE,
      expectedIssuerCuitDigits: ISSUER_CUIT,
      expectedReceptorDigits: CLIENT_CUIT,
      expectedReceptorDocType: 80,
    });

    expect(report).toContain("QR válido: sí");
    expect(report).toContain("tipoCmp: 2");
    expect(report).toContain("importe: 60.50");
    expect(report).toContain("CAE coincide: sí");
    expect(report).not.toContain(CAE);
    expect(report).not.toContain(ISSUER_CUIT);
    expect(report).not.toContain(CLIENT_CUIT);
    expect(() =>
      formatDebitQrVerification({
        ver: 1,
        fecha: "2026-10-05",
        cuit: Number(ISSUER_CUIT),
        ptoVta: 7,
        tipoCmp: 3,
        nroCmp: 1,
        importe: 60.5,
        moneda: "PES",
        ctz: 1,
        tipoCodAut: "E",
        codAut: Number(CAE),
        tipoDocRec: 80,
        nroDocRec: Number(CLIENT_CUIT),
        expectedFecha: "2026-10-05",
        expectedCaeDigits: CAE,
        expectedIssuerCuitDigits: ISSUER_CUIT,
        expectedReceptorDigits: CLIENT_CUIT,
        expectedReceptorDocType: 80,
      }),
    ).toThrow(/QR/);
  });
});

describe("Libro IVA y saldo", () => {
  it("suma 1950 / 409.50 / 2359.50 cuando solo están los cuatro comprobantes", () => {
    const documents = fourDocuments();
    const libro = assessDebitHomologationLibro(documents.invoices, documents.notes);
    const debit = libro.lines.find((line) => line.startsWith("ND "));

    expect(libro.onlyKnownFour).toBe(true);
    expect(libro.totals.netAmount).toBeCloseTo(1950);
    expect(libro.totals.ivaAmount).toBeCloseTo(409.5);
    expect(libro.totals.total).toBeCloseTo(2359.5);
    expect(debit).toContain("neto 50.00");
    expect(debit).toContain("iva 10.50");
    expect(debit).toContain("total 60.50");
    expect(libro.lines.some((line) => line.startsWith("FACTURA A 0007-00000002"))).toBe(true);
  });

  it("informa el total real si hay otro documento de homologación", () => {
    const documents = fourDocuments();
    const libro = assessDebitHomologationLibro(
      [
        ...documents.invoices,
        invoiceSource({
          invoiceNumber: "0007-00000009",
          subtotal: 100,
          ivaAmount: 21,
          total: 121,
          totalVisualRounded: 121,
        }),
      ],
      documents.notes,
    );

    expect(libro.onlyKnownFour).toBe(false);
    expect(libro.lines).toHaveLength(5);
    expect(libro.totals.total).toBeCloseTo(2480.5);
  });

  it("cierra 121000 + 6050 = 127050 y mantiene la factura autorizada e impaga", () => {
    expect(
      assertDebitNoteBalance({
        totalCents: 121_000,
        creditCents: 0,
        debitCents: 6_050,
        allocatedCents: 0,
        fiscalStatus: "AUTORIZADA",
        paymentMethod: "CUENTA_CORRIENTE",
        paymentStatus: "IMPAGA",
      }),
    ).toBe(127_050);
  });
});

describe("aislamiento y convivencia", () => {
  it("no confunde la ND con una factura productiva del mismo número", () => {
    const shared = {
      invoiceId: HOMO_DEBIT_ARTIFACT_INVOICE_ID,
      noteId: HOMO_DEBIT_ARTIFACT_NOTE_ID,
      activeInvoiceIds: ["cmurgdg8k00011of0dfg97v00"],
      activeNoteIds: [],
      dashboardInvoiceIds: [],
      debtorSourceInvoiceIds: ["cmurgdg8k00011of0dfg97v00"],
      movementIds: [],
      movementInvoiceIds: [],
      libroInvoiceIds: ["cmurgdg8k00011of0dfg97v00"],
      libroNoteIds: [],
    };

    expect(() => assertProductionIsolationById(shared)).not.toThrow();
    expect(() =>
      assertProductionIsolationById({
        ...shared,
        libroNoteIds: [HOMO_DEBIT_ARTIFACT_NOTE_ID],
      }),
    ).toThrow(/alcance productivo/);
  });

  it("exige una NC tipo 3 y una ND tipo 2 distintas", () => {
    expect(() =>
      assertCreditAndDebitCoexist([
        {
          id: "nc-1",
          environment: "HOMOLOGACION",
          kind: "CREDIT",
          voucherType: 3,
          sequenceNumber: 1,
          noteNumber: "0007-00000001",
        },
        {
          id: HOMO_DEBIT_ARTIFACT_NOTE_ID,
          environment: "HOMOLOGACION",
          kind: "DEBIT",
          voucherType: 2,
          sequenceNumber: 1,
          noteNumber: "0007-00000001",
        },
      ]),
    ).not.toThrow();
    expect(() =>
      assertCreditAndDebitCoexist([
        {
          id: HOMO_DEBIT_ARTIFACT_NOTE_ID,
          environment: "HOMOLOGACION",
          kind: "DEBIT",
          voucherType: 2,
          sequenceNumber: 1,
          noteNumber: "0007-00000001",
        },
      ]),
    ).toThrow(/no conviven/);
  });

  it("el script no abre ARCA", () => {
    const source = readFileSync("scripts/arca-homo-verify-debit-note-artifacts.ts", "utf8");

    expect(source).toContain("installFetchGuard");
    expect(source).toContain("buildNotePdf");
    expect(source).toContain("issuerSnapshot");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("consultVoucher");
    expect(source).not.toContain("getLastAuthorizedVoucher");
    expect(source).not.toContain("getValidArcaAccessTicket");
    expect(source).not.toContain("getOrCreate");
  });
});
