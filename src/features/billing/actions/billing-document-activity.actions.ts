"use server";

import { z } from "zod";
import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingDocumentActivityService } from "@/server/services/billing-document-activity.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import type { BillingInvoiceActionResult } from "@/features/billing/types/billing-invoice.types";
import type { BillingDocumentActivity } from "@/features/billing/types/billing-document-activity";

const markActivitySchema = z.object({
  documentKind: z.enum(["INVOICE", "RECEIPT", "NOTE"]),
  id: z.string().min(1),
  activity: z.enum(["printed", "downloaded", "shared"]),
});

function toActionError(
  error: unknown,
): BillingInvoiceActionResult<never> {
  if (error instanceof BillingInvoiceError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  console.error("[billingDocumentActivityAction]", error);

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function markBillingDocumentActivityAction(
  input: unknown,
): Promise<BillingInvoiceActionResult<BillingDocumentActivity>> {
  const parsed = markActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await billingDocumentActivityService.mark(
      parsed.data.documentKind,
      parsed.data.id,
      parsed.data.activity,
    );
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
