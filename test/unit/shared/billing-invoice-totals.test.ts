import { describe, expect, it } from "vitest";
import {
  centsToPesos,
  computeInvoiceTotals,
  computeLineNetCents,
  computeLineTotalCents,
  invoiceItemDisplayTotalCents,
  pesosToCents,
  roundVisualTotalCents,
} from "@/shared/utils/billing-invoice-totals";

describe("pesosToCents / centsToPesos", () => {
  it("convierte sin errores de coma flotante", () => {
    expect(pesosToCents(1210.5)).toBe(121050);
    expect(pesosToCents(0.1)).toBe(10);
    expect(pesosToCents(1_000_000)).toBe(100_000_000);
    expect(centsToPesos(121050)).toBe(1210.5);
  });
});

describe("computeLineTotalCents", () => {
  it("multiplica cantidad por precio unitario y redondea a centavo", () => {
    expect(computeLineTotalCents(2, 121000)).toBe(242000);
    expect(computeLineTotalCents(1.5, 100050)).toBe(150075);
    expect(computeLineTotalCents(3, 33333)).toBe(99999);
  });
});

describe("roundVisualTotalCents (PRD §15.1)", () => {
  it("muestra 10.200 para 10.200,01", () => {
    expect(roundVisualTotalCents(1020001)).toBe(1020000);
  });

  it("muestra 10.200 para 10.199,99", () => {
    expect(roundVisualTotalCents(1019999)).toBe(1020000);
  });

  it("redondea a ,50 entre ,41 y ,59", () => {
    expect(roundVisualTotalCents(100041)).toBe(100050);
    expect(roundVisualTotalCents(100050)).toBe(100050);
    expect(roundVisualTotalCents(100059)).toBe(100050);
  });

  it("redondea a 0 por debajo de ,41", () => {
    expect(roundVisualTotalCents(100040)).toBe(100000);
    expect(roundVisualTotalCents(100001)).toBe(100000);
    expect(roundVisualTotalCents(100000)).toBe(100000);
  });

  it("redondea al peso siguiente por encima de ,59", () => {
    expect(roundVisualTotalCents(100060)).toBe(100100);
    expect(roundVisualTotalCents(100099)).toBe(100100);
  });
});

describe("computeInvoiceTotals", () => {
  it("Factura A discrimina neto e IVA del precio cargado (PRD §14.3)", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "A",
      items: [{ quantity: 1, unitPriceCents: pesosToCents(1210) }],
      ivaPercent: 21,
      discountPercent: 0,
    });

    expect(totals.subtotalCents).toBe(pesosToCents(1000));
    expect(totals.ivaCents).toBe(pesosToCents(210));
    expect(totals.totalCents).toBe(pesosToCents(1210));
    expect(totals.discountCents).toBe(0);
  });

  it("Factura A con descuento 5% coincide con el ejemplo del PRD", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "A",
      items: [{ quantity: 3, unitPriceCents: pesosToCents(1210) }],
      ivaPercent: 21,
      discountPercent: 5,
    });

    expect(totals.subtotalCents).toBe(pesosToCents(3000));
    expect(totals.discountCents).toBe(pesosToCents(150));
    expect(totals.ivaCents).toBe(pesosToCents(598.5));
    expect(totals.totalCents).toBe(pesosToCents(3448.5));
  });

  it("Factura B usa el precio final como subtotal (PRD §14.4)", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 1, unitPriceCents: pesosToCents(1210) }],
      ivaPercent: 21,
      discountPercent: 0,
    });

    expect(totals.subtotalCents).toBe(pesosToCents(1210));
    expect(totals.totalCents).toBe(pesosToCents(1210));
    // El IVA se conserva internamente aunque no se muestre (PRD §14.4).
    expect(totals.ivaCents).toBe(pesosToCents(210));
  });

  it("suma varios ítems con cantidades", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [
        { quantity: 2, unitPriceCents: pesosToCents(1000) },
        { quantity: 3, unitPriceCents: pesosToCents(500) },
      ],
      ivaPercent: 21,
      discountPercent: 0,
    });

    expect(totals.lineTotalsCents).toEqual([
      pesosToCents(2000),
      pesosToCents(1500),
    ]);
    expect(totals.subtotalCents).toBe(pesosToCents(3500));
    expect(totals.totalCents).toBe(pesosToCents(3500));
  });

  it("aplica el descuento sobre el subtotal (PRD §14.5)", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 1, unitPriceCents: pesosToCents(10000) }],
      ivaPercent: 21,
      discountPercent: 10,
    });

    expect(totals.subtotalCents).toBe(pesosToCents(10000));
    expect(totals.discountCents).toBe(pesosToCents(1000));
    expect(totals.totalCents).toBe(pesosToCents(9000));
  });

  it("en Factura A el resumen cierra: subtotal - descuento + IVA = total", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "A",
      items: [
        { quantity: 2, unitPriceCents: pesosToCents(1210) },
        { quantity: 1, unitPriceCents: pesosToCents(605) },
      ],
      ivaPercent: 21,
      discountPercent: 15,
    });

    expect(
      totals.subtotalCents - totals.discountCents + totals.ivaCents,
    ).toBe(totals.totalCents);
  });

  it("en Factura B el resumen cierra: subtotal - descuento = total", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 7, unitPriceCents: pesosToCents(333.33) }],
      ivaPercent: 21,
      discountPercent: 5,
    });

    expect(totals.subtotalCents - totals.discountCents).toBe(
      totals.totalCents,
    );
  });

  it("calcula el redondeo visual del total", () => {
    const totals = computeInvoiceTotals({
      invoiceType: "B",
      items: [{ quantity: 1, unitPriceCents: 1019999 }],
      ivaPercent: 21,
      discountPercent: 0,
    });

    expect(totals.totalCents).toBe(1019999);
    expect(totals.totalVisualRoundedCents).toBe(1020000);
  });
});

describe("neto s/IVA de ítem", () => {
  it("Factura A y B muestran el total del ítem sin IVA", () => {
    expect(
      invoiceItemDisplayTotalCents("A", 2, pesosToCents(1210), 21),
    ).toBe(pesosToCents(2000));
    expect(
      invoiceItemDisplayTotalCents("B", 2, pesosToCents(1210), 21),
    ).toBe(pesosToCents(2000));
    expect(computeLineNetCents(1, pesosToCents(1210), 21)).toBe(
      pesosToCents(1000),
    );
  });
});
