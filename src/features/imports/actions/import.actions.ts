"use server";

import { AuthError } from "@/server/auth";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";
import {
  importApplySchema,
  importConfigSchema,
  importDestinationSchema,
  importJobIdSchema,
} from "@/features/imports/schemas/import.schemas";
import type { ImportActionResult, ImportJobDetail } from "@/features/imports/types/import-job.types";
import { toImportJobDetail } from "@/features/imports/types/import-job.types";

function toActionError(error: unknown): ImportActionResult<never> {
  if (error instanceof ImportError) {
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
      primaryCodeColumnKey: parsed.data.primaryCodeColumnKey,
      descriptionColumnKey: parsed.data.descriptionColumnKey,
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
