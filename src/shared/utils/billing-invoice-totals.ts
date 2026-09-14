import type { BillingInvoiceType } from "@/generated/prisma/client";

/**
 * Cálculos monetarios de factura en centavos enteros para evitar errores
 * de coma flotante. Los precios unitarios se cargan con IVA incluido
 * (PRD Facturación §14.3).
 */

export function pesosToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}

export function computeLineTotalCents(
  quantity: number,
  unitPriceCents: number,
): number {
  return Math.round(quantity * unitPriceCents);
}

/**
 * Redondeo visual del total (PRD Facturación §15.1):
 * centavos < 41 → ,00 · entre 41 y 59 → ,50 · > 59 → peso siguiente.
 * No reemplaza el valor fiscal exacto; se guarda por separado.
 */
export function roundVisualTotalCents(totalCents: number): number {
  const cents = totalCents % 100;
  const base = totalCents - cents;

  if (cents < 41) {
    return base;
  }

  if (cents <= 59) {
    return base + 50;
  }

  return base + 100;
}

export type InvoiceItemTotalsInput = {
  quantity: number;
  unitPriceCents: number;
};

export type InvoiceTotalsInput = {
  invoiceType: BillingInvoiceType;
  items: InvoiceItemTotalsInput[];
  /** Alícuota vigente, ej. 21. */
  ivaPercent: number;
  /** Porcentaje de descuento sobre el subtotal; 0 = sin descuento. */
  discountPercent: number;
};

export type InvoiceTotals = {
  lineTotalsCents: number[];
  /** Factura A: neto sin IVA. Factura B: bruto con IVA (PRD §14.3/§14.4). */
  subtotalCents: number;
  discountCents: number;
  ivaCents: number;
  totalCents: number;
  totalVisualRoundedCents: number;
};

export function extractNetCents(grossCents: number, ivaPercent: number): number {
  return Math.round((grossCents * 100) / (100 + ivaPercent));
}

/** Precio unitario con IVA → neto unitario × cantidad (PRD visual Factura A). */
export function computeLineNetCents(
  quantity: number,
  unitPriceCents: number,
  ivaPercent: number,
): number {
  return Math.round(quantity * extractNetCents(unitPriceCents, ivaPercent));
}

export function invoiceItemDisplayTotalCents(
  invoiceType: BillingInvoiceType,
  quantity: number,
  unitPriceCents: number,
  ivaPercent: number,
): number {
  switch (invoiceType) {
    case "A":
    case "B":
      return computeLineNetCents(quantity, unitPriceCents, ivaPercent);
    default: {
      const exhaustive: never = invoiceType;
      return exhaustive;
    }
  }
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const lineTotalsCents = input.items.map((item) =>
    computeLineTotalCents(item.quantity, item.unitPriceCents),
  );

  const grossCents = lineTotalsCents.reduce((sum, line) => sum + line, 0);
  const grossAfterDiscountCents = Math.round(
    (grossCents * (100 - input.discountPercent)) / 100,
  );

  const netCents = extractNetCents(grossCents, input.ivaPercent);
  const netAfterDiscountCents = extractNetCents(
    grossAfterDiscountCents,
    input.ivaPercent,
  );

  const ivaCents = grossAfterDiscountCents - netAfterDiscountCents;
  const totalCents = grossAfterDiscountCents;

  let subtotalCents: number;
  let discountCents: number;

  switch (input.invoiceType) {
    case "A":
      subtotalCents = netCents;
      discountCents = netCents - netAfterDiscountCents;
      break;
    case "B":
      subtotalCents = grossCents;
      discountCents = grossCents - grossAfterDiscountCents;
      break;
    default: {
      const exhaustiveCheck: never = input.invoiceType;
      return exhaustiveCheck;
    }
  }

  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    ivaCents,
    totalCents,
    totalVisualRoundedCents: roundVisualTotalCents(totalCents),
  };
}
