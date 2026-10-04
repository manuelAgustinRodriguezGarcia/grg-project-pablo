"use server";

import { revalidatePath } from "next/cache";
import type {
  BillingFiscalEnvironment,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { issueBillingNoteSchema } from "@/features/billing/schemas/billing-note.schemas";
import { requirePermission } from "@/server/auth";
import { AuthError } from "@/server/auth/errors";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { issueArcaNote } from "@/server/arca/notes/issue-arca-note";
import { arcaEmissionRepository } from "@/server/arca/repositories/arca-emission.repository";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { pesosToCents } from "@/shared/utils/billing-invoice-totals";

const NOTE_AMBIGUOUS_MESSAGE =
  "No se pudo confirmar todavía el resultado de ARCA. Podés reintentar la consulta sin crear otro comprobante.";

export type IssueBillingNoteSuccess = {
  ok: true;
  note: {
    id: string;
    kind: BillingNoteKind;
    noteNumber: string;
    fiscalStatus: "AUTORIZADA";
    environment: BillingFiscalEnvironment;
  };
};

export type IssueBillingNoteFailure = {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
  emissionStatus?: "ambiguous" | "rejected" | "failed_pre_send";
};

export type IssueBillingNoteActionResult =
  | IssueBillingNoteSuccess
  | IssueBillingNoteFailure;

function failure(
  code: string,
  message: string,
  retryable: boolean,
  emissionStatus?: IssueBillingNoteFailure["emissionStatus"],
): IssueBillingNoteFailure {
  return {
    ok: false,
    code,
    message,
    retryable,
    ...(emissionStatus ? { emissionStatus } : {}),
  };
}

function retryableFailureCode(code: string): boolean {
  switch (code) {
    case "VALIDATION_ERROR":
    case "NOTE_PRODUCTION_EMISSION_DISABLED":
    case "PRODUCTION_EMISSION_DISABLED":
    case "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE":
    case "ARCA_CONFIGURATION_ERROR":
    case "ARCA_IDEMPOTENCY_CONFLICT":
    case "ARCA_INVOICE_REJECTED":
      return false;
    default:
      return true;
  }
}

function revalidateIssuedNote() {
  revalidatePath("/admin/facturacion/facturas");
  revalidatePath("/admin/facturacion/movimientos");
  revalidatePath("/admin/facturacion/clientes");
  revalidatePath("/admin/facturacion/deudores");
  revalidatePath("/admin/facturacion");
}

export async function issueBillingNoteAction(
  input: unknown,
): Promise<IssueBillingNoteActionResult> {
  const parsed = issueBillingNoteSchema.safeParse(input);

  if (!parsed.success) {
    return failure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Datos inválidos.",
      false,
    );
  }

  const amountCents = pesosToCents(parsed.data.amount);

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return failure(
      "VALIDATION_ERROR",
      "El importe tiene que ser mayor a cero.",
      false,
    );
  }

  try {
    const { profile } = await requirePermission("movements.create");
    const result = await issueArcaNote({
      kind: parsed.data.kind,
      invoiceId: parsed.data.invoiceId,
      amountCents,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      createdByUserId: profile.id,
    });

    switch (result.status) {
      case "completed": {
        const note = await billingNoteRepository.findById(result.noteId);

        if (!note || note.fiscalStatus !== "AUTORIZADA") {
          return failure(
            "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING",
            "ARCA autorizó la nota, pero no pudo leerse el comprobante guardado. Reintentá la consulta sin cambiar los datos.",
            true,
          );
        }

        revalidateIssuedNote();
        return {
          ok: true,
          note: {
            id: note.id,
            kind: note.kind,
            noteNumber: note.noteNumber,
            fiscalStatus: "AUTORIZADA",
            environment: note.environment,
          },
        };
      }
      case "rejected": {
        const emission = await arcaEmissionRepository.findById(result.emissionId);
        const fiscalError = emission?.errors[0];
        const message = fiscalError?.message.trim()
          ? `${fiscalError.code}: ${fiscalError.message}`
              .replace(/\s+/g, " ")
              .slice(0, 240)
          : "ARCA rechazó el comprobante.";

        return failure(
          fiscalError?.code || "ARCA_INVOICE_REJECTED",
          message,
          false,
          "rejected",
        );
      }
      case "ambiguous":
        return failure(
          result.code || "ARCA_EMISSION_STATUS_UNCERTAIN",
          NOTE_AMBIGUOUS_MESSAGE,
          true,
          "ambiguous",
        );
      case "failed_pre_send":
        return failure(
          result.code,
          result.message,
          retryableFailureCode(result.code),
          "failed_pre_send",
        );
      default: {
        const unexpected: never = result;
        return unexpected;
      }
    }
  } catch (error) {
    if (error instanceof BillingInvoiceError) {
      return failure(error.code, error.message, retryableFailureCode(error.code));
    }

    if (error instanceof ArcaEmissionError) {
      if (
        error.code === "ARCA_AMBIGUOUS_VOUCHER_NOT_FOUND" ||
        error.code === "ARCA_AMBIGUOUS_VOUCHER_MISMATCH"
      ) {
        return failure(error.code, NOTE_AMBIGUOUS_MESSAGE, true, "ambiguous");
      }

      return failure(error.code, error.message, false);
    }

    if (error instanceof AuthError) {
      return failure(error.code, error.message, false);
    }

    console.error("[issueBillingNoteAction]", error);
    return failure("UNEXPECTED", getSafeClientMessage(error), false);
  }
}
