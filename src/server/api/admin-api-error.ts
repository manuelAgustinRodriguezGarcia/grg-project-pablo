import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { ImportError } from "@/server/services/import.errors";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { UploadedFileError } from "@/server/services/uploaded-file.errors";
import { StorageError, StorageValidationError } from "@/server/storage";

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

export function mapBillingInvoiceErrorToResponse(
  error: BillingInvoiceError,
): NextResponse {
  const statusByCode: Record<string, number> = {
    VALIDATION_ERROR: 400,
    BILLING_CLIENT_NOT_FOUND: 404,
    BILLING_RUBRO_NOT_FOUND: 404,
    BILLING_RUBRO_INACTIVE: 409,
    GENERIC_CLIENT_LIMIT_EXCEEDED: 400,
    ENVIRONMENT_NOT_SUPPORTED: 409,
    NUMBER_GENERATION_FAILED: 500,
    BILLING_INVOICE_NOT_FOUND: 404,
    BILLING_RECEIPT_NOT_FOUND: 404,
    SALDO_CHANGED: 409,
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

  if (error instanceof BillingInvoiceError) {
    return mapBillingInvoiceErrorToResponse(error);
  }

  if (error instanceof StorageValidationError) {
    return NextResponse.json(
      { error: error.message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (error instanceof StorageError) {
    return NextResponse.json(
      { error: error.message, code: "STORAGE_ERROR" },
      { status: 400 },
    );
  }

  if (domainHandler) {
    const response = domainHandler(error);
    if (response) {
      return response;
    }
  }

  if (isNextInternalControlError(error)) {
    throw error;
  }

  console.error("[admin-api]", error);
  const message =
    error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function isNextInternalControlError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
