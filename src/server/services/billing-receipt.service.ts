import { Prisma } from "@/generated/prisma/client";
import type {
  BillingPaymentMethod,
  BillingReceiptPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/server/database/prisma";
import { buildReceiptPdf } from "@/server/pdf/build-receipt-pdf";
import { loadRothamelLogoPng } from "@/server/pdf/load-rothamel-logo";
import { resolveInvoicePdfIssuer } from "@/server/pdf/invoice-pdf-issuer";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingClientRepository } from "@/server/repositories/billing-client.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import {
  billingReceiptRepository,
  sumAllocationsByInvoiceIds,
} from "@/server/repositories/billing-receipt.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { syncInvoiceSettlement, releaseOverpaymentsForClient } from "@/server/services/billing-invoice-settlement";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { buildReceiptNumber, formatReceiptNumber } from "@/features/billing/utils/receipt-number";
import { remainingCents, splitApplyWithCredit } from "@/features/billing/utils/receipt-allocation";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

const MAX_NOTES_LENGTH = 1000;
const NUMBER_GENERATION_MAX_ATTEMPTS = 5;

export type ReceiptAllocationInput = {
  invoiceId: string;
  amount: number;
};

export type CreateBillingReceiptInput = {
  clientId: string;
  amount: number;
  paymentMethod: BillingReceiptPaymentMethod;
  notes?: string | null;
  useClientCredit?: boolean;
  allocations: ReceiptAllocationInput[];
};

export type AllocateBillingReceiptInput = {
  receiptId: string;
  allocations: ReceiptAllocationInput[];
  notes?: string | null;
};

function sanitizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim() || null;
  if (trimmed && trimmed.length > MAX_NOTES_LENGTH) {
    throw new BillingInvoiceError(
      `Las observaciones no pueden superar ${MAX_NOTES_LENGTH} caracteres.`,
      "VALIDATION_ERROR",
    );
  }
  return trimmed;
}

function mergeAllocations(
  allocations: ReceiptAllocationInput[],
): ReceiptAllocationInput[] {
  const amounts = new Map<string, number>();
  for (const allocation of allocations) {
    const cents = pesosToCents(allocation.amount);
    if (cents <= 0) {
      continue;
    }
    amounts.set(allocation.invoiceId, (amounts.get(allocation.invoiceId) ?? 0) + cents);
  }

  return [...amounts.entries()].map(([invoiceId, cents]) => ({
    invoiceId,
    amount: centsToPesos(cents),
  }));
}

async function creditBucketsForClient(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<Array<{ receiptId: string; remainingCents: number }>> {
  const receipts = await tx.billingReceipt.findMany({
    where: { clientId },
    orderBy: [{ issuedAt: "asc" }, { sequenceNumber: "asc" }],
    select: {
      id: true,
      amount: true,
      allocations: { select: { amount: true } },
    },
  });

  return receipts
    .map((receipt) => ({
      receiptId: receipt.id,
      remainingCents: remainingCents(
        pesosToCents(receipt.amount.toNumber()),
        pesosToCents(
          receipt.allocations.reduce(
            (sum, allocation) => sum + allocation.amount.toNumber(),
            0,
          ),
        ),
      ),
    }))
    .filter((receipt) => receipt.remainingCents > 0);
}

async function applyCreditAllocations(
  tx: Prisma.TransactionClient,
  items: Array<{ receiptId: string; invoiceId: string; amountCents: number }>,
): Promise<void> {
  for (const item of items) {
    const amount = new Prisma.Decimal(centsToPesos(item.amountCents).toFixed(2));
    await tx.billingReceiptAllocation.upsert({
      where: {
        receiptId_invoiceId: {
          receiptId: item.receiptId,
          invoiceId: item.invoiceId,
        },
      },
      create: {
        receiptId: item.receiptId,
        invoiceId: item.invoiceId,
        amount,
      },
      update: {
        amount: { increment: centsToPesos(item.amountCents) },
      },
    });
  }
}

async function outstandingPesosForInvoice(
  invoiceId: string,
  totalVisualRounded: number,
  paymentStatus: BillingPaymentStatus,
): Promise<number> {
  if (paymentStatus === "PAGA" || paymentStatus === "ANULADA") {
    return 0;
  }
  const allocated = await sumAllocationsByInvoiceIds([invoiceId]);
  const invoice = await billingInvoiceRepository.findById(invoiceId);
  const credit = (invoice?.billingNotes ?? [])
    .filter((note) => note.kind === "CREDIT")
    .reduce((sum, note) => sum + note.amount.toNumber(), 0);
  const debit = (invoice?.billingNotes ?? [])
    .filter((note) => note.kind === "DEBIT")
    .reduce((sum, note) => sum + note.amount.toNumber(), 0);
  const outstandingCents = Math.max(
    0,
    pesosToCents(totalVisualRounded) +
      pesosToCents(debit) -
      pesosToCents(credit) -
      pesosToCents(allocated.get(invoiceId) ?? 0),
  );
  return centsToPesos(outstandingCents);
}

function assertInvoiceAcceptsReceipt(invoice: {
  invoiceNumber: string;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
}): void {
  if (invoice.paymentMethod !== "CUENTA_CORRIENTE") {
    throw new BillingInvoiceError(
      `La factura ${invoice.invoiceNumber} no es de cuenta corriente.`,
      "VALIDATION_ERROR",
    );
  }
  if (invoice.paymentStatus === "PAGA" || invoice.paymentStatus === "ANULADA") {
    throw new BillingInvoiceError(
      invoice.paymentStatus === "ANULADA"
        ? `La factura ${invoice.invoiceNumber} está anulada.`
        : `La factura ${invoice.invoiceNumber} ya está paga.`,
      "VALIDATION_ERROR",
    );
  }
}

async function syncInvoicePaymentStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  totalVisualRounded: number,
): Promise<BillingPaymentStatus> {
  const result = await syncInvoiceSettlement(tx, invoiceId, totalVisualRounded);
  return result.paymentStatus;
}

export class BillingReceiptService {
  async listReceipts() {
    await requirePermission("movements.read");
    return billingReceiptRepository.findAllOrdered();
  }

  async createReceipt(input: CreateBillingReceiptInput) {
    const { profile: admin } = await requirePermission("movements.create");
    const client = await billingClientRepository.findById(input.clientId);
    if (!client) {
      throw new BillingInvoiceError(
        "Elegí un cliente.",
        "BILLING_CLIENT_NOT_FOUND",
      );
    }

    const amountCents = pesosToCents(input.amount);
    if (amountCents <= 0) {
      throw new BillingInvoiceError(
        "El importe tiene que ser mayor a cero.",
        "VALIDATION_ERROR",
      );
    }

    const allocations = mergeAllocations(input.allocations);
    const allocatedCents = allocations.reduce(
      (sum, allocation) => sum + pesosToCents(allocation.amount),
      0,
    );
    if (!input.useClientCredit && allocatedCents > amountCents) {
      throw new BillingInvoiceError(
        "Lo imputado no puede superar el cobro.",
        "VALIDATION_ERROR",
      );
    }

    const invoices = await billingInvoiceRepository.findByIds(
      allocations.map((allocation) => allocation.invoiceId),
    );
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    for (const allocation of allocations) {
      const invoice = invoicesById.get(allocation.invoiceId);
      if (!invoice) {
        throw new BillingInvoiceError(
          "Factura no encontrada.",
          "BILLING_INVOICE_NOT_FOUND",
        );
      }
      if (invoice.clientId !== client.id) {
        throw new BillingInvoiceError(
          "La factura no pertenece a ese cliente.",
          "VALIDATION_ERROR",
        );
      }
      assertInvoiceAcceptsReceipt(invoice);
      const outstanding = await outstandingPesosForInvoice(
        invoice.id,
        invoice.totalVisualRounded.toNumber(),
        invoice.paymentStatus,
      );
      if (pesosToCents(allocation.amount) > pesosToCents(outstanding)) {
        throw new BillingInvoiceError(
          `Supera el saldo de la factura ${invoice.invoiceNumber}.`,
          "SALDO_CHANGED",
        );
      }
    }

    const notes = sanitizeNotes(input.notes);

    for (let attempt = 0; attempt < NUMBER_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const sequenceNumber = await billingReceiptRepository.getNextSequenceNumber();

      try {
        const receipt = await prisma.$transaction(async (tx) => {
          let cashAllocations = allocations;
          const invoicesToSync = new Set(
            allocations.map((allocation) => allocation.invoiceId),
          );

          if (input.useClientCredit) {
            await releaseOverpaymentsForClient(client.id, tx);
            const buckets = await creditBucketsForClient(tx, client.id);
            const availableCreditCents = buckets.reduce(
              (sum, bucket) => sum + bucket.remainingCents,
              0,
            );
            const creditBudgetCents = Math.min(
              availableCreditCents,
              Math.max(0, allocatedCents - amountCents),
            );
            const split = splitApplyWithCredit(
              allocations.map((allocation) => ({
                invoiceId: allocation.invoiceId,
                applyCents: pesosToCents(allocation.amount),
              })),
              buckets,
              creditBudgetCents,
            );
            const cashCents = split.newReceiptAllocations.reduce(
              (sum, row) => sum + row.amountCents,
              0,
            );
            if (cashCents > amountCents) {
              throw new BillingInvoiceError(
                "Lo imputado no puede superar el cobro y el saldo a favor.",
                "VALIDATION_ERROR",
              );
            }

            await applyCreditAllocations(tx, split.creditAllocations);
            for (const item of split.creditAllocations) {
              invoicesToSync.add(item.invoiceId);
            }

            cashAllocations = split.newReceiptAllocations.map((row) => ({
              invoiceId: row.invoiceId,
              amount: centsToPesos(row.amountCents),
            }));
          }

          const created = await tx.billingReceipt.create({
            data: {
              receiptNumber: buildReceiptNumber(sequenceNumber),
              sequenceNumber,
              clientId: client.id,
              amount: new Prisma.Decimal(centsToPesos(amountCents).toFixed(2)),
              paymentMethod: input.paymentMethod,
              notes,
              createdByUserId: admin.id,
              allocations: {
                create: cashAllocations.map((allocation) => ({
                  invoiceId: allocation.invoiceId,
                  amount: new Prisma.Decimal(allocation.amount.toFixed(2)),
                })),
              },
            },
          });

          for (const invoiceId of invoicesToSync) {
            const invoice = invoicesById.get(invoiceId);
            if (!invoice) {
              continue;
            }
            await syncInvoicePaymentStatus(
              tx,
              invoice.id,
              invoice.totalVisualRounded.toNumber(),
            );
          }

          return created;
        });

        auditService.logOperationSafe({
          userId: admin.id,
          action: AUDIT_ACTIONS.BILLING_RECEIPT_CREATED,
          entityType: AUDIT_ENTITY_TYPES.BILLING_RECEIPT,
          entityId: receipt.id,
        });

        const loaded = await billingReceiptRepository.findById(receipt.id);
        if (!loaded) {
          throw new BillingInvoiceError(
            "Recibo no encontrado.",
            "BILLING_RECEIPT_NOT_FOUND",
          );
        }
        return loaded;
      } catch (error) {
        if (!billingReceiptRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingInvoiceError(
      "No se pudo generar un número de recibo único. Intente de nuevo.",
      "NUMBER_GENERATION_FAILED",
    );
  }

  async allocateReceipt(input: AllocateBillingReceiptInput) {
    const { profile: admin } = await requirePermission("movements.update");
    const receipt = await billingReceiptRepository.findById(input.receiptId);
    if (!receipt) {
      throw new BillingInvoiceError(
        "Recibo no encontrado.",
        "BILLING_RECEIPT_NOT_FOUND",
      );
    }

    const alreadyAllocatedCents = pesosToCents(
      receipt.allocations.reduce(
        (sum, allocation) => sum + allocation.amount.toNumber(),
        0,
      ),
    );
    const remaining = remainingCents(
      pesosToCents(receipt.amount.toNumber()),
      alreadyAllocatedCents,
    );
    if (remaining <= 0) {
      throw new BillingInvoiceError(
        "Ese recibo ya está imputado por completo.",
        "VALIDATION_ERROR",
      );
    }

    const allocations = mergeAllocations(input.allocations);
    const newCents = allocations.reduce(
      (sum, allocation) => sum + pesosToCents(allocation.amount),
      0,
    );
    if (newCents <= 0) {
      throw new BillingInvoiceError(
        "Elegí al menos una factura para imputar.",
        "VALIDATION_ERROR",
      );
    }
    if (newCents > remaining) {
      throw new BillingInvoiceError(
        "Lo imputado no puede superar el cobro.",
        "VALIDATION_ERROR",
      );
    }

    const invoices = await billingInvoiceRepository.findByIds(
      allocations.map((allocation) => allocation.invoiceId),
    );
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    for (const allocation of allocations) {
      const invoice = invoicesById.get(allocation.invoiceId);
      if (!invoice) {
        throw new BillingInvoiceError(
          "Factura no encontrada.",
          "BILLING_INVOICE_NOT_FOUND",
        );
      }
      if (invoice.clientId !== receipt.clientId) {
        throw new BillingInvoiceError(
          "La factura no pertenece a ese cliente.",
          "VALIDATION_ERROR",
        );
      }
      assertInvoiceAcceptsReceipt(invoice);
      const outstanding = await outstandingPesosForInvoice(
        invoice.id,
        invoice.totalVisualRounded.toNumber(),
        invoice.paymentStatus,
      );
      if (pesosToCents(allocation.amount) > pesosToCents(outstanding)) {
        throw new BillingInvoiceError(
          `Supera el saldo de la factura ${invoice.invoiceNumber}.`,
          "SALDO_CHANGED",
        );
      }
    }

    const notes = sanitizeNotes(input.notes);

    await prisma.$transaction(async (tx) => {
      if (notes) {
        await tx.billingReceipt.update({
          where: { id: receipt.id },
          data: { notes },
        });
      }

      for (const allocation of allocations) {
        await tx.billingReceiptAllocation.upsert({
          where: {
            receiptId_invoiceId: {
              receiptId: receipt.id,
              invoiceId: allocation.invoiceId,
            },
          },
          create: {
            receiptId: receipt.id,
            invoiceId: allocation.invoiceId,
            amount: new Prisma.Decimal(allocation.amount.toFixed(2)),
          },
          update: {
            amount: { increment: allocation.amount },
          },
        });
      }

      for (const allocation of allocations) {
        const invoice = invoicesById.get(allocation.invoiceId);
        if (!invoice) {
          continue;
        }
        await syncInvoicePaymentStatus(
          tx,
          invoice.id,
          invoice.totalVisualRounded.toNumber(),
        );
      }
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_RECEIPT_ALLOCATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_RECEIPT,
      entityId: receipt.id,
    });

    const loaded = await billingReceiptRepository.findById(receipt.id);
    if (!loaded) {
      throw new BillingInvoiceError(
        "Recibo no encontrado.",
        "BILLING_RECEIPT_NOT_FOUND",
      );
    }
    return loaded;
  }

  async generateReceiptPdf(receiptId: string): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requirePermission("movements.read");
    const receipt = await billingReceiptRepository.findById(receiptId);

    if (!receipt) {
      throw new BillingInvoiceError(
        "Recibo no encontrado.",
        "BILLING_RECEIPT_NOT_FOUND",
      );
    }

    const [settings, logoPng, client] = await Promise.all([
      billingFiscalSettingsRepository.getOrCreate(),
      loadRothamelLogoPng(),
      billingClientRepository.findById(receipt.clientId),
    ]);

    const bytes = await buildReceiptPdf({
      receiptNumber: formatReceiptNumber(receipt.receiptNumber),
      issuedAt: receipt.issuedAt,
      amount: receipt.amount.toNumber(),
      paymentMethod: receipt.paymentMethod,
      notes: receipt.notes,
      createdByName: receipt.createdBy.name,
      clientName: receipt.client.name,
      clientIdentificationType: client?.identificationType ?? "NINGUNO",
      clientIdentificationNumber: client?.identificationNumber ?? null,
      allocations: receipt.allocations.map((allocation) => ({
        invoiceNumber: allocation.invoice.invoiceNumber,
        invoiceType: allocation.invoice.invoiceType,
        amount: allocation.amount.toNumber(),
      })),
      remainingAmount: centsToPesos(
        remainingCents(
          pesosToCents(receipt.amount.toNumber()),
          pesosToCents(
            receipt.allocations.reduce(
              (sum, allocation) => sum + allocation.amount.toNumber(),
              0,
            ),
          ),
        ),
      ),
      issuer: resolveInvoicePdfIssuer(settings),
      logoPng,
      environment: settings.environment,
    });

    return {
      bytes,
      filename: `Recibo-${receipt.receiptNumber}.pdf`,
    };
  }
}

export const billingReceiptService = new BillingReceiptService();
