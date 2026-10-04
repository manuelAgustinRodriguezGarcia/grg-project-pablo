import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  finalizedNoteFromWrite,
  type ArcaNoteFinalizeGateway,
  type ArcaNoteWrite,
  type FinalizedArcaNote,
} from "@/server/arca/notes/finalize-approved-arca-note-emission";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import {
  findArcaEmissionInTransaction,
  markArcaNoteEmissionCompleted,
} from "@/server/arca/repositories/arca-emission.repository";
import { syncInvoiceSettlement } from "@/server/services/billing-invoice-settlement";
import { prisma } from "@/server/database/prisma";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";

const FINALIZE_LOCK_MAX_WAIT_MS = 20_000;
const FINALIZE_LOCK_TIMEOUT_MS = 15_000;

function decimalFromCents(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(centsToPesos(cents).toFixed(2));
}

function pesosFromLockedTotal(value: unknown): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return (value.toNumber as () => number)();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return new Prisma.Decimal(value).toNumber();
  }

  throw new ArcaEmissionError(
    "El total de la factura asociada no es válido.",
    "ARCA_EMISSION_SNAPSHOT_MISMATCH",
  );
}

/**
 * Lock de fila de la factura dentro de la transacción del finalizador.
 * No reemplaza el advisory lock fiscal: ese sigue reservando el número por voucherType.
 */
async function lockBillingInvoiceForSettlement(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; fiscalStatus: string; totalVisualRounded: unknown }>
  >`
    SELECT "id", "fiscalStatus", "totalVisualRounded"
    FROM "BillingInvoice"
    WHERE "id" = ${invoiceId}
    FOR UPDATE
  `;
  const row = rows.length === 1 ? rows[0] : null;

  if (!row) {
    throw new ArcaEmissionError(
      "La factura asociada no existe.",
      "ARCA_EMISSION_SNAPSHOT_MISMATCH",
    );
  }

  if (row.fiscalStatus !== "AUTORIZADA") {
    throw new ArcaEmissionError(
      "La factura asociada perdió el estado fiscal autorizado.",
      "ARCA_EMISSION_SNAPSHOT_MISMATCH",
    );
  }

  return pesosFromLockedTotal(row.totalVisualRounded);
}

export async function commitApprovedNote(
  tx: Prisma.TransactionClient,
  emissionId: string,
  write: ArcaNoteWrite,
): Promise<FinalizedArcaNote> {
  const emission = await findArcaEmissionInTransaction(emissionId, tx);

  if (!emission || emission.status !== "APPROVED_PENDING_PERSISTENCE") {
    throw new ArcaEmissionError(
      "La emisión no está autorizada para persistir la nota.",
      "ARCA_EMISSION_NOT_READY_FOR_PERSISTENCE",
    );
  }

  if (emission.noteId || emission.invoiceId) {
    throw new ArcaEmissionError(
      "La emisión ya está vinculada a un comprobante.",
      "ARCA_APPROVED_EMISSION_INCOMPLETE",
    );
  }

  const totalVisualRounded = await lockBillingInvoiceForSettlement(tx, write.invoiceId);
  const created = await tx.billingNote.create({
    data: {
      kind: write.kind,
      environment: write.environment,
      fiscalStatus: "AUTORIZADA",
      invoiceType: write.invoiceType,
      pointOfSale: write.pointOfSale,
      sequenceNumber: write.sequenceNumber,
      noteNumber: write.noteNumber,
      voucherType: write.voucherType,
      issuedAt: write.issuedAt,
      invoiceId: write.invoiceId,
      clientId: write.clientId,
      clientCode: write.clientCode,
      clientName: write.clientName,
      clientIdentificationType: write.clientIdentificationType,
      clientIdentificationNumber: write.clientIdentificationNumber,
      clientIvaCondition: write.clientIvaCondition,
      amount: decimalFromCents(write.amountCents),
      netAmount: decimalFromCents(write.netAmountCents),
      ivaAmount: decimalFromCents(write.ivaAmountCents),
      ivaPercent: new Prisma.Decimal(write.ivaPercent),
      reason: write.reason,
      cae: write.cae,
      caeExpiresAt: write.caeExpiresAt,
      qrUrl: null,
      createdByUserId: write.createdByUserId,
    },
    select: { id: true },
  });
  const settlement = await syncInvoiceSettlement(tx, write.invoiceId, totalVisualRounded);

  if (settlement.fiscalStatus !== "AUTORIZADA") {
    throw new ArcaEmissionError(
      "La factura asociada perdió el estado fiscal autorizado.",
      "ARCA_EMISSION_SNAPSHOT_MISMATCH",
    );
  }

  await markArcaNoteEmissionCompleted(emissionId, created.id, tx);

  return finalizedNoteFromWrite(created.id, write, {
    paymentStatus: settlement.paymentStatus,
    fiscalStatus: "AUTORIZADA",
    outstandingCents: settlement.outstandingCents,
  });
}

function gateway(tx: Prisma.TransactionClient): ArcaNoteFinalizeGateway {
  return {
    readEmission(id) {
      return findArcaEmissionInTransaction(id, tx);
    },
    async readNote(id) {
      const note = await tx.billingNote.findUnique({ where: { id } });

      if (!note || note.fiscalStatus !== "AUTORIZADA" || !note.cae || !note.caeExpiresAt || !note.voucherType) {
        return null;
      }

      if (note.environment === "MODO_PRUEBA") {
        return null;
      }

      return {
        id: note.id,
        kind: note.kind,
        environment: note.environment,
        fiscalStatus: "AUTORIZADA",
        invoiceType: note.invoiceType,
        pointOfSale: note.pointOfSale,
        sequenceNumber: note.sequenceNumber,
        noteNumber: note.noteNumber,
        voucherType: note.voucherType,
        invoiceId: note.invoiceId,
        amountCents: pesosToCents(note.amount.toNumber()),
        netAmountCents: pesosToCents(note.netAmount.toNumber()),
        ivaAmountCents: pesosToCents(note.ivaAmount.toNumber()),
        cae: note.cae,
        caeExpiresAt: note.caeExpiresAt.toISOString(),
        qrUrl: null,
        settlement: null,
      };
    },
    commit(emissionId, write) {
      return commitApprovedNote(tx, emissionId, write);
    },
  };
}

export function runArcaNoteFinalizeTransaction(
  emissionId: string,
  work: (gateway: ArcaNoteFinalizeGateway) => Promise<{
    status: "completed";
    emissionId: string;
    note: FinalizedArcaNote;
  }>,
) {
  return prisma.$transaction((tx) => work(gateway(tx)), {
    maxWait: FINALIZE_LOCK_MAX_WAIT_MS,
    timeout: FINALIZE_LOCK_TIMEOUT_MS,
  });
}
