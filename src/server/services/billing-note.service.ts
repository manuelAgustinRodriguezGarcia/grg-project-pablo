import type { BillingNoteKind } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/server/database/prisma";
import { buildNotePdf } from "@/server/pdf/build-note-pdf";
import { resolveInvoicePdfIssuer } from "@/server/pdf/invoice-pdf-issuer";
import { loadRothamelLogoPng } from "@/server/pdf/load-rothamel-logo";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { syncInvoiceSettlement, loadInvoiceSettlementSums } from "@/server/services/billing-invoice-settlement";
import {
  creditNoteCapCents,
  invoiceOutstandingCents,
  splitGrossIvaCents,
} from "@/features/billing/utils/invoice-settlement";
import { buildNoteNumber } from "@/features/billing/utils/note-number";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

const NUMBER_GENERATION_MAX_ATTEMPTS = 5;

export type CreateBillingNoteInput = {
  kind: BillingNoteKind;
  invoiceId: string;
  amount: number;
  reason: string;
};

function validationError(message: string): BillingInvoiceError {
  return new BillingInvoiceError(message, "VALIDATION_ERROR");
}

export class BillingNoteService {
  async listNotes() {
    await requirePermission("movements.read");
    return billingNoteRepository.findAllOrdered();
  }

  async createNote(input: CreateBillingNoteInput) {
    const { profile: admin } = await requirePermission("movements.create");
    const invoice = await billingInvoiceRepository.findById(input.invoiceId);
    if (!invoice) {
      throw new BillingInvoiceError(
        "Factura no encontrada.",
        "BILLING_INVOICE_NOT_FOUND",
      );
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw validationError("Indicá el motivo.");
    }

    const amountCents = pesosToCents(input.amount);
    if (amountCents <= 0) {
      throw validationError("El importe tiene que ser mayor a cero.");
    }

    const settings = await billingFiscalSettingsRepository.getOrCreate();
    const totalCents = pesosToCents(invoice.totalVisualRounded.toNumber());

    for (let attempt = 0; attempt < NUMBER_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const sequenceNumber = await billingNoteRepository.getNextSequenceNumber(
        input.kind,
      );

      try {
        const created = await prisma.$transaction(async (tx) => {
          const sums = await loadInvoiceSettlementSums(tx, invoice.id);
          if (input.kind === "CREDIT") {
            const cap = creditNoteCapCents(
              totalCents,
              sums.creditCents,
              sums.debitCents,
            );
            if (cap <= 0) {
              throw validationError(
                "Esta factura no tiene importe disponible para una nota de crédito.",
              );
            }
            if (amountCents > cap) {
              throw validationError(
                `El importe no puede superar ${centsToPesos(cap).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
              );
            }
          } else {
            const outstanding = invoiceOutstandingCents(
              totalCents,
              sums.creditCents,
              sums.debitCents,
              sums.allocatedCents,
            );
            if (invoice.paymentMethod !== "CUENTA_CORRIENTE") {
              throw validationError(
                "La nota de débito solo aplica a facturas de cuenta corriente.",
              );
            }
            if (
              invoice.paymentStatus === "PAGA" ||
              invoice.paymentStatus === "ANULADA" ||
              outstanding <= 0
            ) {
              throw validationError(
                "La nota de débito solo aplica a facturas de cuenta corriente con saldo pendiente.",
              );
            }
          }

          const split = splitGrossIvaCents(
            amountCents,
            invoice.ivaPercent.toNumber(),
          );
          const noteNumber = buildNoteNumber(
            settings.pointOfSale,
            input.kind,
            sequenceNumber,
          );

          const note = await tx.billingNote.create({
            data: {
              kind: input.kind,
              environment: settings.environment,
              invoiceType: invoice.invoiceType,
              pointOfSale: settings.pointOfSale,
              sequenceNumber,
              noteNumber,
              invoiceId: invoice.id,
              clientId: invoice.clientId,
              clientCode: invoice.clientCode,
              clientName: invoice.clientName,
              clientIdentificationType: invoice.clientIdentificationType,
              clientIdentificationNumber: invoice.clientIdentificationNumber,
              clientIvaCondition: invoice.clientIvaCondition,
              amount: new Prisma.Decimal(centsToPesos(amountCents).toFixed(2)),
              ivaPercent: invoice.ivaPercent,
              ivaAmount: new Prisma.Decimal(
                centsToPesos(split.ivaCents).toFixed(2),
              ),
              netAmount: new Prisma.Decimal(
                centsToPesos(split.netCents).toFixed(2),
              ),
              reason,
              createdByUserId: admin.id,
            },
          });

          await syncInvoiceSettlement(
            tx,
            invoice.id,
            invoice.totalVisualRounded.toNumber(),
          );

          return note;
        });

        auditService.logOperationSafe({
          userId: admin.id,
          action: AUDIT_ACTIONS.BILLING_NOTE_CREATED,
          entityType: AUDIT_ENTITY_TYPES.BILLING_NOTE,
          entityId: created.id,
        });

        const loaded = await billingNoteRepository.findById(created.id);
        if (!loaded) {
          throw new BillingInvoiceError(
            "Nota no encontrada.",
            "BILLING_NOTE_NOT_FOUND",
          );
        }
        return loaded;
      } catch (error) {
        if (!billingNoteRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingInvoiceError(
      "No se pudo generar un número de nota único. Intente de nuevo.",
      "NUMBER_GENERATION_FAILED",
    );
  }

  async generateNotePdf(noteId: string): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    await requirePermission("movements.read");
    const note = await billingNoteRepository.findById(noteId);
    if (!note) {
      throw new BillingInvoiceError(
        "Nota no encontrada.",
        "BILLING_NOTE_NOT_FOUND",
      );
    }

    const [settings, logoPng] = await Promise.all([
      billingFiscalSettingsRepository.getOrCreate(),
      loadRothamelLogoPng(),
    ]);

    const bytes = await buildNotePdf({
      kind: note.kind,
      noteNumber: note.noteNumber,
      invoiceType: note.invoiceType,
      invoiceNumber: note.invoice.invoiceNumber,
      issuedAt: note.issuedAt,
      amount: note.amount.toNumber(),
      netAmount: note.netAmount.toNumber(),
      ivaAmount: note.ivaAmount.toNumber(),
      ivaPercent: note.ivaPercent.toNumber(),
      reason: note.reason,
      clientName: note.clientName,
      clientCode: note.clientCode,
      clientIdentificationType: note.clientIdentificationType,
      clientIdentificationNumber: note.clientIdentificationNumber,
      createdByName: note.createdBy.name,
      issuer: resolveInvoicePdfIssuer(settings),
      logoPng,
      environment: note.environment,
    });

    const prefix = note.kind === "CREDIT" ? "Nota-credito" : "Nota-debito";
    return {
      bytes,
      filename: `${prefix}-${note.noteNumber}.pdf`,
    };
  }
}

export const billingNoteService = new BillingNoteService();
