"use server";

import { AuthError } from "@/server/auth";
import { catalogService } from "@/server/services/catalog.service";
import { CatalogError } from "@/server/services/catalog.errors";
import { StorageError } from "@/server/storage/errors";
import {
  catalogIdSchema,
  createCatalogSchema,
  reorderCatalogsSchema,
  setCatalogVisibilitySchema,
  updateCatalogSchema,
} from "@/features/catalog/schemas/catalog.schemas";
import type {
  CatalogActionResult,
  CatalogListItem,
  ClearCatalogResult,
} from "@/features/catalog/types/catalog.types";
import { toCatalogListItem } from "@/features/catalog/types/catalog.types";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";

function toActionError(error: unknown): CatalogActionResult<never> {
  if (error instanceof CatalogError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof AuthError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof StorageError) {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }

  if (error instanceof Error) {
    return { success: false, error: getSafeClientMessage(error) };
  }

  return { success: false, error: "Ocurrió un error inesperado." };
}

export async function listCatalogsAction(): Promise<
  CatalogActionResult<CatalogListItem[]>
> {
  try {
    const catalogs = await catalogService.listCatalogs();
    return { success: true, data: catalogs.map(toCatalogListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createCatalogAction(
  input: unknown,
): Promise<CatalogActionResult<CatalogListItem>> {
  const parsed = createCatalogSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const catalog = await catalogService.createCatalog(parsed.data);
    return { success: true, data: toCatalogListItem(catalog) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCatalogAction(
  input: unknown,
): Promise<CatalogActionResult<CatalogListItem>> {
  const parsed = updateCatalogSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const catalog = await catalogService.updateCatalog(parsed.data);
    return { success: true, data: toCatalogListItem(catalog) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderCatalogsAction(
  input: unknown,
): Promise<CatalogActionResult<CatalogListItem[]>> {
  const parsed = reorderCatalogsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const catalogs = await catalogService.reorderCatalogs(parsed.data);
    return { success: true, data: catalogs.map(toCatalogListItem) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setCatalogVisibilityAction(
  input: unknown,
): Promise<CatalogActionResult<CatalogListItem>> {
  const parsed = setCatalogVisibilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const catalog = await catalogService.setCatalogVisibility(
      parsed.data.catalogId,
      parsed.data.visible,
    );
    return { success: true, data: toCatalogListItem(catalog) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCatalogAction(
  input: unknown,
): Promise<CatalogActionResult<void>> {
  const parsed = catalogIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogService.deleteCatalog(parsed.data.catalogId);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearCatalogAction(
  input: unknown,
): Promise<CatalogActionResult<ClearCatalogResult>> {
  const parsed = catalogIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const result = await catalogService.clearCatalog(parsed.data.catalogId);
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setCoverImageAction(
  formData: FormData,
): Promise<CatalogActionResult<CatalogListItem>> {
  const catalogId = formData.get("catalogId");
  const file = formData.get("file");

  const parsedId = catalogIdSchema.safeParse({ catalogId });

  if (!parsedId.success) {
    return {
      success: false,
      error: parsedId.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      error: "Debes seleccionar una imagen válida.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const catalog = await catalogService.setCoverImage({
      catalogId: parsedId.data.catalogId,
      body: buffer,
      contentType: file.type || "application/octet-stream",
      originalFilename: file.name,
    });
    return { success: true, data: toCatalogListItem(catalog) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeCoverImageAction(
  input: unknown,
): Promise<CatalogActionResult<CatalogListItem>> {
  const parsed = catalogIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const catalog = await catalogService.removeCoverImage(parsed.data.catalogId);
    return { success: true, data: toCatalogListItem(catalog) };
  } catch (error) {
    return toActionError(error);
  }
}
