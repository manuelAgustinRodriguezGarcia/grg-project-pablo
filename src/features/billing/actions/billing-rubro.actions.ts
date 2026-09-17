"use server";

import { AuthError } from "@/server/auth";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";
import { billingRubroService } from "@/server/services/billing-rubro.service";
import { BillingRubroError } from "@/server/services/billing-rubro.errors";
import {
  billingRubroIdSchema,
  createBillingRubroSchema,
  updateBillingRubroSchema,
} from "@/features/billing/schemas/billing-rubro.schemas";
import type {
  BillingRubroActionResult,
  BillingRubroListItem,
} from "@/features/billing/types/billing-rubro.types";
import { toBillingRubroListItem } from "@/features/billing/types/billing-rubro.types";

function toActionError(error: unknown): BillingRubroActionResult<never> {
  if (error instanceof BillingRubroError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listBillingRubrosAction(): Promise<
  BillingRubroActionResult<BillingRubroListItem[]>
> {
  try {
    const rubros = await billingRubroService.listRubros();
    return { success: true, data: rubros.map(toBillingRubroListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createBillingRubroAction(
  input: unknown,
): Promise<BillingRubroActionResult<BillingRubroListItem>> {
  const parsed = createBillingRubroSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const rubro = await billingRubroService.createRubro(parsed.data);
    return { success: true, data: toBillingRubroListItem(rubro) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateBillingRubroAction(
  input: unknown,
): Promise<BillingRubroActionResult<BillingRubroListItem>> {
  const parsed = updateBillingRubroSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const rubro = await billingRubroService.updateRubro(parsed.data);
    return { success: true, data: toBillingRubroListItem(rubro) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteBillingRubroAction(
  input: unknown,
): Promise<BillingRubroActionResult<void>> {
  const parsed = billingRubroIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await billingRubroService.deleteRubro(parsed.data.rubroId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
