"use server";

import { AuthError } from "@/server/auth";
import { UploadedFileError } from "@/server/services/uploaded-file.errors";
import { uploadedFileService } from "@/server/services/uploaded-file.service";
import {
  uploadedFileDeleteBodySchema,
  uploadedFileIdSchema,
  uploadedFileReportQuerySchema,
} from "@/features/files/schemas/uploaded-file.schemas";
import type {
  UploadedFileDetail,
  UploadedFileDownloadResponse,
  UploadedFileReportResponse,
} from "@/features/files/types/uploaded-file.types";
import { getSafeClientMessage } from "@/server/errors/sanitize-error";

export type UploadedFileActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

function toActionError(error: unknown): UploadedFileActionResult<never> {
  if (error instanceof UploadedFileError) {
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

export async function reprocessUploadedFileAction(
  input: unknown,
): Promise<UploadedFileActionResult<{ jobId: string; uploadedFileId: string }>> {
  const parsed = uploadedFileIdSchema.safeParse(
    typeof input === "string" ? { fileId: input } : input,
  );

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await uploadedFileService.reprocess(parsed.data.fileId);
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteUploadedFileAction(
  input: unknown,
): Promise<UploadedFileActionResult<{ success: true }>> {
  const parsed = uploadedFileDeleteBodySchema
    .extend({ fileId: uploadedFileIdSchema.shape.fileId })
    .safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await uploadedFileService.deleteFile(parsed.data.fileId, {
      confirmed: parsed.data.confirmed,
    });
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getUploadedFileDetailAction(
  input: unknown,
): Promise<UploadedFileActionResult<UploadedFileDetail>> {
  const parsed = uploadedFileIdSchema.safeParse(
    typeof input === "string" ? { fileId: input } : input,
  );

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await uploadedFileService.getFileDetail(parsed.data.fileId);
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getUploadedFileDownloadUrlAction(
  input: unknown,
): Promise<UploadedFileActionResult<UploadedFileDownloadResponse>> {
  const parsed = uploadedFileIdSchema.safeParse(
    typeof input === "string" ? { fileId: input } : input,
  );

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await uploadedFileService.getDownloadUrl(parsed.data.fileId);
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getUploadedFileReportAction(
  input: unknown,
): Promise<UploadedFileActionResult<UploadedFileReportResponse>> {
  const parsed = uploadedFileIdSchema
    .merge(uploadedFileReportQuerySchema)
    .safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const data = await uploadedFileService.getReport(
      parsed.data.fileId,
      parsed.data.jobId,
    );
    return { success: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
