import { describe, expect, it } from "vitest";
import { buildArcaCaeRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import type { ArcaBillingInvoiceInput } from "@/server/arca/adapters/billing-invoice-to-cae";
import { ArcaInvoiceAdapterError } from "@/server/arca/errors/arca-invoice-adapter.error";
import { serializeCaeRequest } from "@/server/arca/wsfe/wsfe-cae-request";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import {
  ARCA_CONCEPT_PRODUCTS,
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  ARCA_VAT_RATE_ID,
  UnsupportedArcaVatConditionError,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  centsToPesos,
  computeInvoiceTotals,
} from "@/shared/utils/billing-invoice-totals";

const ISSUER_CUIT = "30712345671";
const CLIENT_CUIT = "30500010912";
const CLIENT_DNI = "12345678";

function invoiceInput(
  overrides: Partial<ArcaBillingInvoiceInput> = {},
): ArcaBillingInvoiceInput {
  return {
    environment: overrides.environment ?? "HOMOLOGACION",
    issuerCuit: overrides.issuerCuit ?? ISSUER_CUIT,
    pointOfSale: overrides.pointOfSale ?? 7,
    voucherNumber: overrides.voucherNumber ?? 15,
    voucherDate: overrides.voucherDate ?? "2026-09-30",
    invoiceType: overrides.invoiceType ?? "A",
    ivaPercent: overrides.ivaPercent ?? 21,
    client: {
      identificationType: "CUIT",
      identificationNumber: CLIENT_CUIT,
      ivaCondition: "RESPONSABLE_INSCRIPTO",
      ...overrides.client,
    },
    totals: {
      netCents: 100_000,
      vatCents: 21_000,
      totalCents: 121_000,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
      totalVisualRoundedCents: 121_050,
      ...overrides.totals,
    },
  };
}

function expectFiscalAmounts(
  request: ReturnType<typeof buildArcaCaeRequest>,
  amounts: { net: number; vat: number; total: number },
) {
  expect(request.netAmount).toBe(amounts.net);
  expect(request.vatAmount).toBe(amounts.vat);
  expect(request.totalAmount).toBe(amounts.total);
  expect(request.nonTaxedAmount).toBe(0);
  expect(request.exemptAmount).toBe(0);
  expect(request.taxAmount).toBe(0);
  expect(request.vatBreakdown).toEqual([
    {
      id: ARCA_VAT_RATE_ID[21],
      baseAmount: amounts.net,
      amount: amounts.vat,
    },
  ]);
  expect(
    request.netAmount +
      request.vatAmount +
      request.nonTaxedAmount +
      request.exemptAmount +
      request.taxAmount,
  ).toBe(request.totalAmount);
}

describe("buildArcaCaeRequest", () => {
  it("arma Factura A para Responsable Inscripto con CUIT", () => {
    const request = buildArcaCaeRequest(invoiceInput());

    expect(request.voucherType).toBe(1);
    expect(request.documentType).toBe(80);
    expect(request.documentNumber).toBe(Number(CLIENT_CUIT));
    expect(request.receiverVatConditionId).toBe(1);
    expectFiscalAmounts(request, { net: 1000, vat: 210, total: 1210 });
    expect(request.vatBreakdown[0]?.id).toBe(5);
  });

  it("arma Factura A para Monotributista con CUIT", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        client: { identificationType: "CUIT", ivaCondition: "MONOTRIBUTISTA" },
      }),
    );

    expect(request.voucherType).toBe(1);
    expect(request.documentType).toBe(80);
    expect(request.receiverVatConditionId).toBe(6);
    expectFiscalAmounts(request, { net: 1000, vat: 210, total: 1210 });
  });

  it("arma Factura B para Consumidor Final con CUIT", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        invoiceType: "B",
        client: { identificationType: "CUIT", ivaCondition: "CONSUMIDOR_FINAL" },
      }),
    );

    expect(request.voucherType).toBe(6);
    expect(request.documentType).toBe(80);
    expect(request.documentNumber).toBe(Number(CLIENT_CUIT));
    expect(request.receiverVatConditionId).toBe(5);
    expectFiscalAmounts(request, { net: 1000, vat: 210, total: 1210 });
  });

  it("arma Factura B para Consumidor Final con DNI", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        invoiceType: "B",
        client: {
          identificationType: "DNI",
          identificationNumber: "12.345.678",
          ivaCondition: "CONSUMIDOR_FINAL",
        },
      }),
    );

    expect(request.voucherType).toBe(6);
    expect(request.documentType).toBe(96);
    expect(request.documentNumber).toBe(Number(CLIENT_DNI));
    expect(request.receiverVatConditionId).toBe(5);
  });

  it("arma Factura B para Consumidor Final sin documento", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        invoiceType: "B",
        client: {
          identificationType: "NINGUNO",
          identificationNumber: "999",
          ivaCondition: "CONSUMIDOR_FINAL",
        },
      }),
    );

    expect(request.voucherType).toBe(6);
    expect(request.documentType).toBe(99);
    expect(request.documentNumber).toBe(0);
    expect(request.receiverVatConditionId).toBe(5);
    expectFiscalAmounts(request, { net: 1000, vat: 210, total: 1210 });
  });

  it("arma Factura B para Exento sin pasar el neto gravado a operaciones exentas", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        invoiceType: "B",
        client: { identificationType: "CUIT", ivaCondition: "EXENTO" },
      }),
    );

    expect(request.voucherType).toBe(6);
    expect(request.documentType).toBe(80);
    expect(request.receiverVatConditionId).toBe(4);
    expect(request.exemptAmount).toBe(0);
    expectFiscalAmounts(request, { net: 1000, vat: 210, total: 1210 });
  });

  it("rechaza Responsable No Inscripto sin armar el request", () => {
    expect(() =>
      buildArcaCaeRequest(
        invoiceInput({
          invoiceType: "B",
          client: {
            identificationType: "CUIT",
            ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
          },
        }),
      ),
    ).toThrow(UnsupportedArcaVatConditionError);
    expect(() =>
      buildArcaCaeRequest(
        invoiceInput({
          invoiceType: "B",
          client: {
            identificationType: "CUIT",
            ivaCondition: "RESPONSABLE_NO_INSCRIPTO",
          },
        }),
      ),
    ).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_ARCA_VAT_CONDITION" }),
    );
  });

  it.each([
    ["RESPONSABLE_INSCRIPTO", "B"],
    ["MONOTRIBUTISTA", "B"],
    ["CONSUMIDOR_FINAL", "A"],
  ] as const)(
    "rechaza %s con letra %s",
    (ivaCondition, invoiceType) => {
      expect(() =>
        buildArcaCaeRequest(
          invoiceInput({
            invoiceType,
            client: { identificationType: "CUIT", ivaCondition },
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          name: "ArcaInvoiceAdapterError",
          code: "ARCA_INVOICE_TYPE_MISMATCH",
        }),
      );
    },
  );

  it("rechaza CUIT o DNI vacíos", () => {
    expect(() =>
      buildArcaCaeRequest(
        invoiceInput({
          client: {
            identificationType: "CUIT",
            identificationNumber: "  ",
            ivaCondition: "RESPONSABLE_INSCRIPTO",
          },
        }),
      ),
    ).toThrow(ArcaInvoiceAdapterError);
    expect(() =>
      buildArcaCaeRequest(
        invoiceInput({
          invoiceType: "B",
          client: {
            identificationType: "DNI",
            identificationNumber: null,
            ivaCondition: "CONSUMIDOR_FINAL",
          },
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "ARCA_DOCUMENT_REQUIRED",
        message: "El DNI del cliente es obligatorio.",
      }),
    );
  });

  it("rechaza una alícuota sin Id", () => {
    expect(() =>
      buildArcaCaeRequest(invoiceInput({ ivaPercent: 10.5 })),
    ).toThrow(
      expect.objectContaining({ code: "ARCA_UNSUPPORTED_VAT_RATE" }),
    );
  });

  it("usa el neto fiscal ya calculado y no vuelve a aplicar el descuento", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "A",
      items: [{ quantity: 1, unitPriceCents: 121_000 }],
      ivaPercent: 21,
      discountPercent: 10,
    });
    const request = buildArcaCaeRequest(
      invoiceInput({
        totals: {
          netCents: totals.netCents,
          vatCents: totals.ivaCents,
          totalCents: totals.totalCents,
          nonTaxedCents: 0,
          exemptCents: 0,
          taxCents: 0,
        },
      }),
    );

    expect(request.netAmount).toBe(centsToPesos(totals.netCents));
    expect(request.vatAmount).toBe(centsToPesos(totals.ivaCents));
    expect(request.totalAmount).toBe(centsToPesos(totals.totalCents));
    expect(request.netAmount).not.toBe(centsToPesos(totals.subtotalCents));
    expectFiscalAmounts(request, {
      net: centsToPesos(totals.netCents),
      vat: centsToPesos(totals.ivaCents),
      total: centsToPesos(totals.totalCents),
    });
  });

  it("ignora el total visual redondeado", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 1, unitPriceCents: 1_019_999 }],
      ivaPercent: 21,
      discountPercent: 0,
    });
    const request = buildArcaCaeRequest(
      invoiceInput({
        invoiceType: "B",
        client: {
          identificationType: "NINGUNO",
          ivaCondition: "CONSUMIDOR_FINAL",
        },
        totals: {
          netCents: totals.netCents,
          vatCents: totals.ivaCents,
          totalCents: totals.totalCents,
          nonTaxedCents: 0,
          exemptCents: 0,
          taxCents: 0,
          totalVisualRoundedCents: totals.totalVisualRoundedCents,
        },
      }),
    );

    expect(totals.totalCents).not.toBe(totals.totalVisualRoundedCents);
    expect(request.totalAmount).toBe(centsToPesos(totals.totalCents));
    expect(request.totalAmount).not.toBe(
      centsToPesos(totals.totalVisualRoundedCents),
    );
    expect(request).not.toHaveProperty("totalVisualRoundedCents");
  });

  it("copia el número recibido y formatea la fecha en el día de Argentina", () => {
    const request = buildArcaCaeRequest(
      invoiceInput({
        voucherNumber: 15,
        voucherDate: new Date("2026-10-01T02:30:00.000Z"),
      }),
    );

    expect(request.voucherFrom).toBe(15);
    expect(request.voucherTo).toBe(15);
    expect(request.voucherDate).toBe("20260930");
    expect(request.concept).toBe(ARCA_CONCEPT_PRODUCTS);
    expect(request.concept).toBe(1);
    expect(request.currencyId).toBe(ARCA_CURRENCY_ID);
    expect(request.currencyId).toBe("PES");
    expect(request.currencyRate).toBe(ARCA_CURRENCY_RATE);
    expect(request.currencyRate).toBe(1);
  });

  it("produce un request que requestCae puede serializar", () => {
    const request = buildArcaCaeRequest(invoiceInput());
    const serialized = serializeCaeRequest({
      ...request,
      accessTicket: {
        token: "token",
        sign: "sign",
        generationTime: new Date("2026-09-30T12:00:00.000Z"),
        expirationTime: new Date("2026-09-30T18:00:00.000Z"),
        service: "wsfe",
        environment: "HOMOLOGACION",
      },
    } satisfies ArcaCaeRequest);

    expect(serialized.totalAmount).toBe("1210.00");
    expect(serialized.netAmount).toBe("1000.00");
    expect(serialized.vatAmount).toBe("210.00");
    expect(serialized.vatLines).toEqual([
      { id: 5, baseAmount: "1000.00", amount: "210.00" },
    ]);
  });
});
