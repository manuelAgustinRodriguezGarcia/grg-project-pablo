import { describe, expect, it } from "vitest";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import type { ArcaBillingNoteIntent } from "@/server/arca/adapters/billing-note-to-cae";
import { ArcaNoteAdapterError } from "@/server/arca/errors/arca-note-adapter.error";
import { serializeCaeRequest } from "@/server/arca/wsfe/wsfe-cae-request";
import { buildFeCaeSolicitarXml } from "@/server/arca/wsfe/wsfe-soap";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import { ARCA_VAT_RATE_ID } from "@/shared/fiscal/arca-fiscal-mapping";

const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";
const ASSOCIATED_CAE = "71234567890123";

function noteIntent(
  overrides: Omit<
    Partial<ArcaBillingNoteIntent>,
    "receptor" | "associatedInvoice"
  > & {
    receptor?: Partial<ArcaBillingNoteIntent["receptor"]>;
    associatedInvoice?: Partial<ArcaBillingNoteIntent["associatedInvoice"]>;
  } = {},
): ArcaBillingNoteIntent {
  return {
    kind: overrides.kind ?? "CREDIT",
    invoiceType: overrides.invoiceType ?? "A",
    amountCents: overrides.amountCents ?? 121_000,
    netAmountCents: overrides.netAmountCents ?? 100_000,
    ivaAmountCents: overrides.ivaAmountCents ?? 21_000,
    ivaPercent: overrides.ivaPercent ?? 21,
    issuedAt: overrides.issuedAt ?? "2026-10-03",
    environment: overrides.environment ?? "PRODUCCION",
    issuerCuit: overrides.issuerCuit ?? ISSUER_CUIT,
    voucherNumber: overrides.voucherNumber ?? 4,
    receptor: {
      identificationType: "CUIT",
      identificationNumber: CLIENT_CUIT,
      ivaCondition: "RESPONSABLE_INSCRIPTO",
      ...overrides.receptor,
    },
    associatedInvoice: {
      invoiceType: "A",
      pointOfSale: "0007",
      sequenceNumber: 9,
      issuedAt: "2026-09-30",
      environment: "PRODUCCION",
      fiscalStatus: "AUTORIZADA",
      cae: ASSOCIATED_CAE,
      ...overrides.associatedInvoice,
    },
  };
}

function requestOf(intent: ArcaBillingNoteIntent) {
  return buildArcaNoteCaeRequest(intent);
}

describe("buildArcaNoteCaeRequest", () => {
  it.each([
    ["CREDIT", "A", 3],
    ["DEBIT", "A", 2],
    ["CREDIT", "B", 8],
    ["DEBIT", "B", 7],
  ] as const)("arma %s %s con voucherType %s", (kind, invoiceType, voucherType) => {
    const receptor =
      invoiceType === "A"
        ? {
            identificationType: "CUIT" as const,
            identificationNumber: CLIENT_CUIT,
            ivaCondition: "RESPONSABLE_INSCRIPTO" as const,
          }
        : {
            identificationType: "NINGUNO" as const,
            identificationNumber: null,
            ivaCondition: "CONSUMIDOR_FINAL" as const,
          };
    const request = requestOf(
      noteIntent({
        kind,
        invoiceType,
        receptor,
        associatedInvoice: { invoiceType },
      }),
    );

    expect(request.voucherType).toBe(voucherType);
    expect(request.voucherFrom).toBe(4);
    expect(request.voucherTo).toBe(4);
    expect(request.associatedVouchers).toEqual([
      {
        type: invoiceType === "A" ? 1 : 6,
        pointOfSale: 7,
        number: 9,
        issuerCuit: ISSUER_CUIT,
        issuedAt: "20260930",
      },
    ]);
  });

  it("conserva importes exactos, documento y condición IVA", () => {
    const request = requestOf(
      noteIntent({
        amountCents: 12_100,
        netAmountCents: 10_000,
        ivaAmountCents: 2_100,
      }),
    );

    expect(request.totalAmount).toBe(121);
    expect(request.netAmount).toBe(100);
    expect(request.vatAmount).toBe(21);
    expect(request.nonTaxedAmount).toBe(0);
    expect(request.exemptAmount).toBe(0);
    expect(request.taxAmount).toBe(0);
    expect(request.documentType).toBe(80);
    expect(request.documentNumber).toBe(Number(CLIENT_CUIT));
    expect(request.receiverVatConditionId).toBe(1);
    expect(request.currencyId).toBe("PES");
    expect(request.currencyRate).toBe(1);
    expect(request.concept).toBe(1);
    expect(request.vatBreakdown).toEqual([
      { id: ARCA_VAT_RATE_ID[21], baseAmount: 100, amount: 21 },
    ]);
    expect(JSON.stringify(request)).not.toContain(ASSOCIATED_CAE);
    expect(request.pointOfSale).toBe(7);
    expect(request.associatedVouchers?.[0]?.number).toBe(9);
    expect(request.associatedVouchers?.[0]?.pointOfSale).toBe(7);
  });

  it("usa el punto de venta y la fecha de la factura original", () => {
    const request = requestOf(
      noteIntent({
        issuedAt: "2026-10-03",
        associatedInvoice: {
          pointOfSale: "0012",
          sequenceNumber: 27,
          issuedAt: new Date("2026-10-01T02:30:00.000Z"),
        },
      }),
    );

    expect(request.pointOfSale).toBe(12);
    expect(request.voucherDate).toBe("20261003");
    expect(request.associatedVouchers?.[0]).toMatchObject({
      pointOfSale: 12,
      number: 27,
      issuedAt: "20260930",
      issuerCuit: ISSUER_CUIT,
    });
  });

  it("serializa el CbteAsoc sin llamar a ARCA", () => {
    const request = requestOf(noteIntent());
    const serialized = serializeCaeRequest({
      ...request,
      accessTicket: {
        token: "token",
        sign: "sign",
        generationTime: new Date("2026-10-03T12:00:00.000Z"),
        expirationTime: new Date("2026-10-03T18:00:00.000Z"),
        service: "wsfe",
        environment: "PRODUCCION",
      },
    } satisfies ArcaCaeRequest);
    const xml = buildFeCaeSolicitarXml({
      authXml: "<Auth></Auth>",
      request: serialized,
    });

    expect(xml).toContain("<CbteTipo>3</CbteTipo>");
    expect(xml).toContain("<Tipo>1</Tipo>");
    expect(xml).toContain("<PtoVta>7</PtoVta>");
    expect(xml).toContain("<Nro>9</Nro>");
    expect(xml).toContain(`<Cuit>${ISSUER_CUIT}</Cuit>`);
    expect(xml).toContain("<CbteFch>20260930</CbteFch>");
    expect(xml).toContain("<ImpTotal>1210.00</ImpTotal>");
    expect(xml).toContain("<ImpNeto>1000.00</ImpNeto>");
    expect(xml).toContain("<ImpIVA>210.00</ImpIVA>");
    expect(xml).not.toContain(ASSOCIATED_CAE);
  });

  it.each([
    ["ARCA_ASSOCIATED_INVOICE_NOT_AUTHORIZED", { fiscalStatus: "MODO_PRUEBA" as const }],
    ["ARCA_ASSOCIATED_INVOICE_WITHOUT_CAE", { cae: null }],
    ["ARCA_ASSOCIATED_INVOICE_WITHOUT_CAE", { cae: "   " }],
    [
      "ARCA_NOTE_ENVIRONMENT_MISMATCH",
      { environment: "HOMOLOGACION" as const },
    ],
    ["ARCA_NOTE_INVOICE_TYPE_MISMATCH", { invoiceType: "B" as const }],
    ["ARCA_ASSOCIATED_POINT_OF_SALE_REQUIRED", { pointOfSale: " " }],
    ["ARCA_ASSOCIATED_SEQUENCE_REQUIRED", { sequenceNumber: 0 }],
  ] as const)("rechaza %s", (code, associatedInvoice) => {
    expect(() =>
      requestOf(noteIntent({ associatedInvoice })),
    ).toThrow(ArcaNoteAdapterError);
    expect(() => requestOf(noteIntent({ associatedInvoice }))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it("rechaza una factura de modo prueba aunque el ambiente de la nota coincida", () => {
    expect(() =>
      requestOf(
        noteIntent({
          environment: "MODO_PRUEBA",
          associatedInvoice: { environment: "MODO_PRUEBA" },
        }),
      ),
    ).toThrow(
      expect.objectContaining({ code: "ARCA_ASSOCIATED_INVOICE_ENVIRONMENT" }),
    );
  });

  it.each([
    { amountCents: 0, netAmountCents: 0, ivaAmountCents: 0 },
    { amountCents: 100, netAmountCents: -1, ivaAmountCents: 101 },
    { amountCents: 100, netAmountCents: 100, ivaAmountCents: -1 },
    { amountCents: 121_000, netAmountCents: 100_000, ivaAmountCents: 20_000 },
  ])("rechaza importes inválidos %o", (amounts) => {
    expect(() => requestOf(noteIntent(amounts))).toThrow(ArcaNoteAdapterError);
  });

  it("rechaza un voucherNumber no positivo", () => {
    expect(() => requestOf(noteIntent({ voucherNumber: 0 }))).toThrow(
      expect.objectContaining({ code: "ARCA_NOTE_VOUCHER_NUMBER_INVALID" }),
    );
  });
});
