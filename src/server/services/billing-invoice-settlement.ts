import type { BillingInvoiceFiscalStatus, BillingPaymentStatus } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import {
  creditNoteCapCents,
  invoiceFiscalStatusFromNotes,
  invoiceOutstandingCents,
  invoiceOverpaymentCents,
  invoicePaymentStatusFromSettlement,
  planOverallocationRelease,
} from "@/features/billing/utils/invoice-settlement";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

export type InvoiceSettlementSums = {
  allocatedCents: number;
  creditCents: number;
  debitCents: number;
};

export async function loadInvoiceSettlementSums(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<InvoiceSettlementSums> {
  const [allocated, credits, debits] = await Promise.all([
    tx.billingReceiptAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    }),
    tx.billingNote.aggregate({
      where: { invoiceId, kind: "CREDIT" },
      _sum: { amount: true },
    }),
    tx.billingNote.aggregate({
      where: { invoiceId, kind: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);

  return {
    allocatedCents: pesosToCents(allocated._sum.amount?.toNumber() ?? 0),
    creditCents: pesosToCents(credits._sum.amount?.toNumber() ?? 0),
    debitCents: pesosToCents(debits._sum.amount?.toNumber() ?? 0),
  };
}

async function releaseOverallocatedReceipts(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  excessCents: number,
): Promise<void> {
  if (excessCents <= 0) {
    return;
  }

  const allocations = await tx.billingReceiptAllocation.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true },
  });
  const plan = planOverallocationRelease(
    allocations.map((row) => ({
      id: row.id,
      amountCents: pesosToCents(row.amount.toNumber()),
    })),
    excessCents,
  );

  if (plan.deleteIds.length > 0) {
    await tx.billingReceiptAllocation.deleteMany({
      where: { id: { in: plan.deleteIds } },
    });
  }

  for (const update of plan.updates) {
    await tx.billingReceiptAllocation.update({
      where: { id: update.id },
      data: {
        amount: new Prisma.Decimal(centsToPesos(update.amountCents).toFixed(2)),
      },
    });
  }
}

export async function syncInvoiceSettlement(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  totalVisualRounded: number,
): Promise<{
  paymentStatus: BillingPaymentStatus;
  fiscalStatus: BillingInvoiceFiscalStatus;
  outstandingCents: number;
  creditCapCents: number;
}> {
  const invoice = await tx.billingInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { paymentMethod: true },
  });
  const totalCents = pesosToCents(totalVisualRounded);
  let sums = await loadInvoiceSettlementSums(tx, invoiceId);
  const payableCents = creditNoteCapCents(
    totalCents,
    sums.creditCents,
    sums.debitCents,
  );
  const excessCents = invoiceOverpaymentCents(sums.allocatedCents, payableCents);
  if (excessCents > 0) {
    await releaseOverallocatedReceipts(tx, invoiceId, excessCents);
    sums = await loadInvoiceSettlementSums(tx, invoiceId);
  }
  const outstandingCents = invoiceOutstandingCents(
    totalCents,
    sums.creditCents,
    sums.debitCents,
    sums.allocatedCents,
  );
  const fiscalStatus = invoiceFiscalStatusFromNotes(
    sums.creditCents,
    sums.debitCents,
    totalCents,
  );
  const paymentStatus = invoicePaymentStatusFromSettlement(
    fiscalStatus,
    outstandingCents,
    totalCents,
    invoice.paymentMethod,
  );

  await tx.billingInvoice.update({
    where: { id: invoiceId },
    data: { paymentStatus, fiscalStatus },
  });

  return {
    paymentStatus,
    fiscalStatus,
    outstandingCents,
    creditCapCents: creditNoteCapCents(
      totalCents,
      sums.creditCents,
      sums.debitCents,
    ),
  };
}

export async function releaseOverpaymentsForClient(
  clientId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const run = async (client: Prisma.TransactionClient) => {
    const invoices = await client.billingInvoice.findMany({
      where: { clientId },
      select: { id: true, totalVisualRounded: true },
    });

    for (const invoice of invoices) {
      await syncInvoiceSettlement(
        client,
        invoice.id,
        invoice.totalVisualRounded.toNumber(),
      );
    }
  };

  if (tx) {
    await run(tx);
    return;
  }

  await prisma.$transaction(run);
}
