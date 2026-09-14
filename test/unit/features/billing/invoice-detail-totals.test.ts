import { describe, expect, it } from "vitest";
import {
  invoiceDetailTotals,
  invoiceItemGrossTotal,
  invoiceItemUnitPriceNet,
} from "@/features/billing/utils/invoice-detail-totals";

describe("invoiceDetailTotals", () => {
  it("Factura A sin descuento muestra neto, IVA y total", () => {
    const totals = invoiceDetailTotals({
      invoiceType: "A",
      subtotal: 1000,
      discountPercent: 0,
      discountAmount: 0,
      ivaPercent: 21,
      ivaAmount: 210,
      total: 1210,
      totalVisualRounded: 1210,
    });

    expect(totals.hasDiscount).toBe(false);
    expect(totals.subtotalNet).toBe(1000);
    expect(totals.subtotalNetAfterDiscount).toBe(1000);
    expect(totals.ivaAmount).toBe(210);
    expect(totals.total).toBe(1210);
  });

  it("Factura A con descuento expone subtotal neto posterior", () => {
    const totals = invoiceDetailTotals({
      invoiceType: "A",
      subtotal: 3000,
      discountPercent: 5,
      discountAmount: 150,
      ivaPercent: 21,
      ivaAmount: 598.5,
      total: 3448.5,
      totalVisualRounded: 3448.5,
    });

    expect(totals.hasDiscount).toBe(true);
    expect(totals.subtotalNet).toBe(3000);
    expect(totals.subtotalNetAfterDiscount).toBe(2850);
  });

  it("Factura B expone neto s/IVA aunque el subtotal sea bruto", () => {
    const totals = invoiceDetailTotals({
      invoiceType: "B",
      subtotal: 1210,
      discountPercent: 0,
      discountAmount: 0,
      ivaPercent: 21,
      ivaAmount: 210,
      total: 1210,
      totalVisualRounded: 1210,
    });

    expect(totals.hasDiscount).toBe(false);
    expect(totals.subtotalNet).toBe(1000);
    expect(totals.subtotalNetAfterDiscount).toBe(1000);
  });
});

describe("invoiceItemUnitPriceNet", () => {
  it("extrae el neto s/IVA del precio unitario bruto", () => {
    expect(invoiceItemUnitPriceNet(1200, 21)).toBe(991.74);
  });
});

describe("invoiceItemGrossTotal", () => {
  it("muestra el total del ítem con IVA incluido", () => {
    expect(invoiceItemGrossTotal(1, 100)).toBe(100);
    expect(invoiceItemGrossTotal(2, 1200)).toBe(2400);
  });
});
