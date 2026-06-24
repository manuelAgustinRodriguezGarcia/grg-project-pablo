"use server";

import type { FolderColumn, UserRole } from "@/generated/prisma/client";
import { AuthError, requireAuth } from "@/server/auth";
import { columnConfigService } from "@/server/services/column-config.service";
import { ColumnConfigError } from "@/server/services/column-config.errors";
import { ColumnHelpError } from "@/server/services/column-help.errors";
import { columnHelpService } from "@/server/services/column-help.service";
import {
  columnIdSchema,
  createColumnSchema,
  folderIdParamSchema,
  reorderColumnsSchema,
  setColumnVisibilitySchema,
  updateColumnSchema,
} from "@/features/catalog/schemas/column.schemas";
import type {
  ColumnActionResult,
  ColumnListItem,
} from "@/features/catalog/types/column.types";

async function resolveColumnItem(
  column: FolderColumn,
  role: UserRole,
): Promise<ColumnListItem> {
  const [item] = await columnHelpService.resolveHelpForColumns([column], role);
  return item;
}

async function resolveColumnItems(
  columns: FolderColumn[],
  role: UserRole,
): Promise<ColumnListItem[]> {
  return columnHelpService.resolveHelpForColumns(columns, role);
}

function toActionError(error: unknown): ColumnActionResult<never> {
  if (error instanceof ColumnConfigError || error instanceof ColumnHelpError) {
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

export async function listColumnsAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem[]>> {
  const parsed = folderIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const { profile } = await requireAuth();
    const columns = await columnConfigService.listColumnsForUser(parsed.data.folderId);
    return {
      success: true,
      data: await resolveColumnItems(columns, profile.role),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createColumnAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem>> {
  const parsed = createColumnSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const column = await columnConfigService.createColumn(parsed.data);
    return { success: true, data: await resolveColumnItem(column, "ADMIN") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateColumnAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem>> {
  const parsed = updateColumnSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const column = await columnConfigService.updateColumn(parsed.data);
    return { success: true, data: await resolveColumnItem(column, "ADMIN") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderColumnsAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem[]>> {
  const parsed = reorderColumnsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const columns = await columnConfigService.reorderColumns(parsed.data);
    return { success: true, data: await resolveColumnItems(columns, "ADMIN") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setColumnVisibilityAction(
  input: unknown,
): Promise<ColumnActionResult<ColumnListItem>> {
  const parsed = setColumnVisibilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const column = await columnConfigService.setColumnVisibility(
      parsed.data.id,
      parsed.data.visible,
    );
    return { success: true, data: await resolveColumnItem(column, "ADMIN") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteColumnAction(
  input: unknown,
): Promise<ColumnActionResult<void>> {
  const parsed = columnIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await columnConfigService.deleteColumn(parsed.data.id);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
