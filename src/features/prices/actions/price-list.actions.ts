"use server";

import { AuthError } from "@/server/auth";
import { PriceListError } from "@/server/services/price-list.errors";
import { priceListService } from "@/server/services/price-list.service";
import {
  createPriceListSchema,
  priceListIdSchema,
  updatePriceListSchema,
} from "@/features/prices/schemas/price-list.schemas";
import type {
  PriceListActionResult,
  PriceListListItem,
} from "@/features/prices/types/price-list.types";
import { toPriceListListItem } from "@/features/prices/types/price-list.types";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";

function toActionError(error: unknown): PriceListActionResult<never> {
  if (error instanceof PriceListError) {
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

export async function listPriceListsAction(): Promise<
  PriceListActionResult<PriceListListItem[]>
> {
  try {
    const lists = await priceListService.listPriceLists();
    return { success: true, data: lists.map(toPriceListListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createPriceListAction(
  input: unknown,
): Promise<PriceListActionResult<PriceListListItem>> {
  const parsed = createPriceListSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const list = await priceListService.createPriceList(parsed.data);
    return { success: true, data: toPriceListListItem(list) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePriceListAction(
  input: unknown,
): Promise<PriceListActionResult<PriceListListItem>> {
  const parsed = updatePriceListSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const list = await priceListService.updatePriceList(parsed.data);
    return { success: true, data: toPriceListListItem(list) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePriceListAction(
  input: unknown,
): Promise<PriceListActionResult<{ id: string }>> {
  const parsed = priceListIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await priceListService.deletePriceList(parsed.data.id);
    return { success: true, data: { id: parsed.data.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearPriceListAction(
  input: unknown,
): Promise<PriceListActionResult<{ deletedCount: number }>> {
  const parsed = priceListIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const result = await priceListService.clearPriceList(parsed.data.id);
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
