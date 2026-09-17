import type { BillingInvoiceType } from "@/generated/prisma/client";
import {
  centsToPesos,
  computeLineTotalCents,
  extractNetCents,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";

export type InvoiceDetailTotalsInput = {
  invoiceType: BillingInvoiceType;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  totalVisualRounded: number;
};

export type InvoiceDetailTotalsView = {
  hasDiscount: boolean;
  discountPercent: number;
  subtotalNet: number;
  discountAmount: number;
  subtotalNetAfterDiscount: number;
  ivaAmount: number;
  ivaPercent: number;
  total: number;
};

export function invoiceDetailTotals(
  invoice: InvoiceDetailTotalsInput,
): InvoiceDetailTotalsView {
  const hasDiscount = invoice.discountAmount > 0 && invoice.discountPercent > 0;
  let subtotalNet: number;

  switch (invoice.invoiceType) {
    case "A":
      subtotalNet = invoice.subtotal;
      break;
    case "B":
      subtotalNet = centsToPesos(
        extractNetCents(pesosToCents(invoice.subtotal), invoice.ivaPercent),
      );
      break;
    default: {
      const exhaustive: never = invoice.invoiceType;
      return exhaustive;
    }
  }

  const subtotalNetAfterDiscount = invoice.total - invoice.ivaAmount;

  return {
    hasDiscount,
    discountPercent: invoice.discountPercent,
    subtotalNet,
    discountAmount: invoice.discountAmount,
    subtotalNetAfterDiscount,
    ivaAmount: invoice.ivaAmount,
    ivaPercent: invoice.ivaPercent,
    total: invoice.totalVisualRounded,
  };
}

export function invoiceItemUnitPriceNet(
  unitPrice: number,
  ivaPercent: number,
): number {
  return centsToPesos(extractNetCents(pesosToCents(unitPrice), ivaPercent));
}

export function invoiceItemGrossTotal(
  quantity: number,
  unitPrice: number,
): number {
  return centsToPesos(
    computeLineTotalCents(quantity, pesosToCents(unitPrice)),
  );
}
