import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { ImportError } from "@/server/services/import.errors";
import { UploadedFileError } from "@/server/services/uploaded-file.errors";

type DomainErrorHandler = (error: unknown) => NextResponse | null;

export function mapImportErrorToResponse(error: ImportError): NextResponse {
  const statusByCode: Record<string, number> = {
    IMPORT_NOT_FOUND: 404,
    INVALID_STATE: 409,
    INVALID_FILE: 400,
    FOLDER_NOT_EMPTY: 409,
    CONFIRMATION_REQUIRED: 400,
    ANALYSIS_FAILED: 422,
    PUBLISH_FAILED: 500,
    SHEET_NOT_IMPORTABLE: 400,
    VALIDATION_ERROR: 400,
  };

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: statusByCode[error.code] ?? 400 },
  );
}

export function mapUploadedFileErrorToResponse(
  error: UploadedFileError,
): NextResponse {
  const statusByCode: Record<string, number> = {
    FILE_NOT_FOUND: 404,
    ACTIVE_JOB_EXISTS: 409,
    CONFIRMATION_REQUIRED: 400,
    VALIDATION_ERROR: 400,
  };

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: statusByCode[error.code] ?? 400 },
  );
}

/**
 * Mapea errores de auth y dominio a respuestas HTTP consistentes en rutas admin.
 */
export function handleAdminApiError(
  error: unknown,
  domainHandler?: DomainErrorHandler,
): NextResponse {
  if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (error instanceof AuthError && error.code === "FORBIDDEN") {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 403 },
    );
  }

  if (error instanceof ImportError) {
    return mapImportErrorToResponse(error);
  }

  if (error instanceof UploadedFileError) {
    return mapUploadedFileErrorToResponse(error);
  }

  if (domainHandler) {
    const response = domainHandler(error);
    if (response) {
      return response;
    }
  }

  throw error;
}
