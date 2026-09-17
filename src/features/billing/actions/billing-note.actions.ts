"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingNoteService } from "@/server/services/billing-note.service";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { createBillingNoteSchema } from "@/features/billing/schemas/billing-note.schemas";
import type { BillingNoteActionResult } from "@/features/billing/types/billing-note.types";
import {
  toBillingNoteListItem,
  type BillingNoteListItem,
} from "@/features/billing/types/billing-note.types";

function toActionError(error: unknown): BillingNoteActionResult<never> {
  if (error instanceof BillingInvoiceError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  console.error("[billingNoteAction]", error);

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listBillingNotesAction(): Promise<
  BillingNoteActionResult<BillingNoteListItem[]>
> {
  try {
    const notes = await billingNoteService.listNotes();
    return { success: true, data: notes.map(toBillingNoteListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createBillingNoteAction(
  input: unknown,
): Promise<BillingNoteActionResult<BillingNoteListItem>> {
  const parsed = createBillingNoteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const note = await billingNoteService.createNote(parsed.data);
    return { success: true, data: toBillingNoteListItem(note) };
  } catch (error) {
    return toActionError(error);
  }
}
