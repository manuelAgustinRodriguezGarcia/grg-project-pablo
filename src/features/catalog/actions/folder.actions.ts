"use server";

import { AuthError } from "@/server/auth";
import { folderService } from "@/server/services/folder.service";
import { FolderError } from "@/server/services/folder.errors";
import {
  catalogIdParamSchema,
  createFolderFromSheetSchema,
  createFolderSchema,
  folderIdSchema,
  reorderFoldersSchema,
  setFolderFilterConfigSchema,
  setFolderSearchConfigSchema,
  setFolderVisibilitySchema,
  updateFolderSchema,
} from "@/features/catalog/schemas/folder.schemas";
import type {
  ClearFolderResult,
  FolderActionResult,
  FolderListItem,
} from "@/features/catalog/types/folder.types";
import { toFolderListItem } from "@/features/catalog/types/folder.types";

function toActionError(error: unknown): FolderActionResult<never> {
  if (error instanceof FolderError) {
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

export async function listFoldersAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem[]>> {
  const parsed = catalogIdParamSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folders = await folderService.listFolders(parsed.data.catalogId);
    return { success: true, data: folders.map(toFolderListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createFolderAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = createFolderSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.createFolder(parsed.data);
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createFolderFromSheetAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = createFolderFromSheetSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.createFolderFromSheet(parsed.data);
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateFolderAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = updateFolderSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.updateFolder(parsed.data);
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderFoldersAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem[]>> {
  const parsed = reorderFoldersSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folders = await folderService.reorderFolders(parsed.data);
    return { success: true, data: folders.map(toFolderListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setFolderVisibilityAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = setFolderVisibilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.setFolderVisibility(
      parsed.data.folderId,
      parsed.data.visible,
    );
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteFolderAction(
  input: unknown,
): Promise<FolderActionResult<void>> {
  const parsed = folderIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await folderService.deleteFolder(parsed.data.folderId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearFolderAction(
  input: unknown,
): Promise<FolderActionResult<ClearFolderResult>> {
  const parsed = folderIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const result = await folderService.clearFolder(parsed.data.folderId);
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setFolderSearchConfigAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = setFolderSearchConfigSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.setFolderSearchConfig(
      parsed.data.folderId,
      parsed.data.config,
    );
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setFolderFilterConfigAction(
  input: unknown,
): Promise<FolderActionResult<FolderListItem>> {
  const parsed = setFolderFilterConfigSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const folder = await folderService.setFolderFilterConfig(
      parsed.data.folderId,
      parsed.data.config,
    );
    return { success: true, data: toFolderListItem(folder) };
  } catch (error) {
    return toActionError(error);
  }
}
