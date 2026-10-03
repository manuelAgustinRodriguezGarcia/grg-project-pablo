import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import {
  FINALIZE_LOCK_MAX_WAIT_MS,
  FINALIZE_LOCK_TIMEOUT_MS,
  toCreateBillingInvoiceData,
  type ArcaFinalizeGateway,
  type FinalizedArcaInvoice,
} from "@/server/arca/invoices/finalize-approved-arca-emission";
import {
  findArcaEmissionInTransaction,
  markArcaEmissionCompleted,
} from "@/server/arca/repositories/arca-emission.repository";
import type { BillingInvoiceWithItems } from "@/server/repositories/billing-invoice.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { prisma } from "@/server/database/prisma";

function decimalToCents(value: Prisma.Decimal): number {
  return value.mul(100).toDecimalPlaces(0).toNumber();
}

function fromInvoice(invoice: BillingInvoiceWithItems): FinalizedArcaInvoice {
  if (!invoice.cae || !invoice.caeExpiresAt) {
    throw new ArcaEmissionError(
      "La factura vinculada no tiene CAE.",
      "ARCA_APPROVED_EMISSION_INCOMPLETE",
    );
  }

  return {
    id: invoice.id,
    environment: invoice.environment,
    fiscalStatus: invoice.fiscalStatus,
    invoiceType: invoice.invoiceType,
    pointOfSale: invoice.pointOfSale,
    sequenceNumber: invoice.sequenceNumber,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt.toISOString(),
    clientId: invoice.clientId ?? "",
    clientCode: invoice.clientCode,
    clientName: invoice.clientName,
    clientAddress: invoice.clientAddress,
    clientCity: invoice.clientCity,
    clientProvince: invoice.clientProvince,
    clientEmail: invoice.clientEmail,
    clientWhatsapp: invoice.clientWhatsapp,
    clientIdentificationType: invoice.clientIdentificationType,
    clientIdentificationNumber: invoice.clientIdentificationNumber,
    clientIvaCondition: invoice.clientIvaCondition,
    subtotalCents: decimalToCents(invoice.subtotal),
    discountPercent: invoice.discountPercent.toFixed(2),
    discountAmountCents: decimalToCents(invoice.discountAmount),
    ivaPercent: invoice.ivaPercent.toFixed(2),
    ivaAmountCents: decimalToCents(invoice.ivaAmount),
    totalCents: decimalToCents(invoice.total),
    totalVisualRoundedCents: decimalToCents(invoice.totalVisualRounded),
    paymentMethod: invoice.paymentMethod,
    paymentStatus: invoice.paymentStatus,
    notes: invoice.notes,
    cae: invoice.cae,
    caeExpiresAt: invoice.caeExpiresAt.toISOString(),
    qrUrl: null,
    items: invoice.items.map((item) => ({
      rubroId: item.rubroId,
      rubroCode: item.rubroCode,
      rubroName: item.rubroName,
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPriceCents: decimalToCents(item.unitPrice),
      lineTotalCents: decimalToCents(item.lineTotal),
      sortOrder: item.sortOrder,
    })),
  };
}

function gateway(db: Prisma.TransactionClient): ArcaFinalizeGateway {
  return {
    readEmission(id) {
      return findArcaEmissionInTransaction(id, db);
    },
    async readInvoice(id) {
      const invoice = await billingInvoiceRepository.findById(id, db);
      return invoice ? fromInvoice(invoice) : null;
    },
    async commit(emissionId, write) {
      const current = await findArcaEmissionInTransaction(emissionId, db);

      if (current?.status === "COMPLETED" && current.invoiceId) {
        const existing = await billingInvoiceRepository.findById(current.invoiceId, db);

        if (!existing) {
          throw new ArcaEmissionError(
            "La factura vinculada no existe.",
            "ARCA_APPROVED_EMISSION_INCOMPLETE",
          );
        }

        return fromInvoice(existing);
      }

      const created = await billingInvoiceRepository.create(
        toCreateBillingInvoiceData(write),
        db,
      );
      await markArcaEmissionCompleted(emissionId, created.id, db);
      return fromInvoice(created);
    },
  };
}

export async function runArcaFinalizeTransaction<T>(
  emissionId: string,
  work: (gateway: ArcaFinalizeGateway) => Promise<T>,
): Promise<T> {
  const scope = `arca-finalize|${emissionId}`;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
      return work(gateway(tx));
    },
    {
      maxWait: FINALIZE_LOCK_MAX_WAIT_MS,
      timeout: FINALIZE_LOCK_TIMEOUT_MS,
    },
  );
}
