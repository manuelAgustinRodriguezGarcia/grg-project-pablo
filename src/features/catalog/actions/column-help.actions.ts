"use server";

import { AuthError } from "@/server/auth";
import { ColumnHelpError } from "@/server/services/column-help.errors";
import { columnHelpService } from "@/server/services/column-help.service";
import { columnIdParamSchema } from "@/features/catalog/schemas/column.schemas";
import type {
  ColumnActionResult,
  ColumnListItem,
} from "@/features/catalog/types/column.types";

function toActionError(error: unknown): ColumnActionResult<never> {
  if (error instanceof ColumnHelpError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function getColumnHelpAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem>> {
  const parsed = columnIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const item = await columnHelpService.getColumnHelp(parsed.data.columnId);
    return { success: true, data: item };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteColumnHelpImageAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem>> {
  const parsed = columnIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const item = await columnHelpService.deleteHelpImage(parsed.data.columnId);
    return { success: true, data: item };
  } catch (error) {
    return toActionError(error);
  }
}
