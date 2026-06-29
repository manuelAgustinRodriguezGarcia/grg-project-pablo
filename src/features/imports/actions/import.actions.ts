"use server";

import { AuthError } from "@/server/auth";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";
import { ProductImageError } from "@/server/services/product-image.errors";
import {
  associateImportImageSchema,
  deleteImportImageSchema,
  importApplySchema,
  importConfigSchema,
  importDestinationSchema,
  importImageReviewQuerySchema,
  importJobIdSchema,
  setPriceImportDestinationInputSchema,
  updateImportImageSchema,
} from "@/features/imports/schemas/import.schemas";
import type {
  ImportActionResult,
  ImportImageReviewResponse,
  ImportJobDetail,
} from "@/features/imports/types/import-job.types";
import { toImportJobDetail } from "@/features/imports/types/import-job.types";
import { productImageService } from "@/server/services/product-image.service";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";

function toActionError(error: unknown): ImportActionResult<never> {
  if (error instanceof ImportError) {
    return { success: false, error: error.message, code: error.code };
  }

  if (error instanceof ProductImageError) {
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

export async function analyzeImportAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importJobIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.analyzeJob(parsed.data.jobId);
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setPriceImportDestinationAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = setPriceImportDestinationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.setDestination(parsed.data.jobId, {
      destinationType: "PRICE_LIST",
      priceListId: parsed.data.priceListId,
      sheetName: parsed.data.sheetName,
    });
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setImportDestinationAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importDestinationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.setDestination(parsed.data.jobId, {
      catalogId: parsed.data.catalogId,
      folderId: parsed.data.folderId,
      sheetName: parsed.data.sheetName,
    });
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setImportConfigAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importConfigSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.setConfig(parsed.data.jobId, {
      columnMapping: parsed.data.columnMapping,
      primaryCodeColumnKey: parsed.data.useGeneratedPrimaryCodes
        ? undefined
        : parsed.data.primaryCodeColumnKey,
      descriptionColumnKey: parsed.data.descriptionColumnKey,
      useGeneratedPrimaryCodes: parsed.data.useGeneratedPrimaryCodes ?? false,
    });
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function applyImportAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importApplySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.apply(parsed.data.jobId, {
      actionType: parsed.data.actionType,
      confirmed: parsed.data.confirmed,
    });
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function completeImageReviewAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importJobIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.completeImageReview(parsed.data.jobId);
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listImportImageReviewAction(
  input: unknown,
): Promise<ImportActionResult<ImportImageReviewResponse>> {
  const parsed = importImageReviewQuerySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const result = await productImageService.listImportReview(parsed.data.jobId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      status: parsed.data.status,
    });

    return {
      success: true,
      data: {
        jobId: parsed.data.jobId,
        items: result.items,
        pagination: result.pagination,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function associateImportImageAction(
  input: unknown,
): Promise<ImportActionResult<ImportImageReviewResponse["items"][number]>> {
  const parsed = associateImportImageSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const job = await catalogImportService.getJob(parsed.data.jobId);
    if (!job.folderId) {
      return {
        success: false,
        error: "La importación no tiene carpeta destino.",
        code: "VALIDATION_ERROR",
      };
    }

    const image = await productImageService.associateWithProduct({
      importJobId: parsed.data.jobId,
      imageId: parsed.data.imageId,
      productId: parsed.data.productId,
      folderId: job.folderId,
    });

    return { success: true, data: image };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateImportImageAction(
  input: unknown,
): Promise<ImportActionResult<ImportImageReviewResponse["items"][number]>> {
  const parsed = updateImportImageSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const image = await productImageService.updateImage({
      importJobId: parsed.data.jobId,
      imageId: parsed.data.imageId,
      isPrimary: parsed.data.isPrimary,
      sortOrder: parsed.data.sortOrder,
      label: parsed.data.label,
    });

    return { success: true, data: image };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteImportImageAction(
  input: unknown,
): Promise<ImportActionResult<{ success: true }>> {
  const parsed = deleteImportImageSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await productImageService.softDeleteImage(parsed.data.jobId, parsed.data.imageId);
    return { success: true, data: { success: true } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelImportAction(
  input: unknown,
): Promise<ImportActionResult<ImportJobDetail>> {
  const parsed = importJobIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    await catalogImportService.cancel(parsed.data.jobId);
    const job = await catalogImportService.getJob(parsed.data.jobId);
    return { success: true, data: toImportJobDetail(job) };
  } catch (error) {
    return toActionError(error);
  }
}
