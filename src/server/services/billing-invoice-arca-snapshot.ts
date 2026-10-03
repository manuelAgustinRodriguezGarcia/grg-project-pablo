import "server-only";
import type {
  BillingClient,
  BillingInvoiceType,
  BillingPaymentMethod,
  BillingPaymentStatus,
  BillingRubro,
} from "@/generated/prisma/client";
import type { ArcaBillingPayloadInput } from "@/server/arca/invoices/billing-payload-snapshot";
import type { InvoiceTotals } from "@/shared/utils/billing-invoice-totals";

export type ArcaSnapshotItem = {
  rubroId: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
};

/**
 * Congela cliente, rubros e importes ya calculados.
 * No vuelve a consultar la base.
 */
export function buildArcaBillingPersistenceSnapshot(input: {
  issuedAt: Date;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  client: BillingClient;
  items: ArcaSnapshotItem[];
  rubrosById: Map<string, BillingRubro>;
  totals: InvoiceTotals;
  ivaPercent: number;
  discountPercent: number;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
}): ArcaBillingPayloadInput {
  return {
    issuedAt: input.issuedAt.toISOString(),
    pointOfSale: input.pointOfSale,
    invoiceType: input.invoiceType,
    client: {
      id: input.client.id,
      code: input.client.code,
      name: input.client.name,
      address: input.client.address,
      city: input.client.city,
      province: input.client.province,
      email: input.client.email,
      whatsapp: input.client.whatsapp,
      identificationType: input.client.identificationType,
      identificationNumber: input.client.identificationNumber,
      ivaCondition: input.client.ivaCondition,
    },
    items: input.items.map((item, index) => {
      const rubro = input.rubrosById.get(item.rubroId);

      return {
        rubroId: rubro?.id ?? item.rubroId,
        rubroCode: rubro?.code ?? "",
        rubroName: rubro?.name ?? "",
        description: item.description ?? rubro?.description ?? rubro?.name ?? "",
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: input.totals.lineTotalsCents[index] ?? 0,
        sortOrder: index,
      };
    }),
    financial: {
      subtotalCents: input.totals.subtotalCents,
      discountPercent: input.discountPercent,
      discountAmountCents: input.totals.discountCents,
      ivaPercent: input.ivaPercent,
      ivaAmountCents: input.totals.ivaCents,
      totalCents: input.totals.totalCents,
      totalVisualRoundedCents: input.totals.totalVisualRoundedCents,
      netCents: input.totals.netCents,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
    },
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    notes: input.notes,
  };
}
