import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";
import { BUCKET_CONFIGS } from "@/server/storage/config";
import { STORAGE_BUCKETS } from "@/server/storage/types";

const EXCEL_CONFIG = BUCKET_CONFIGS[STORAGE_BUCKETS.EXCEL_ORIGINALS];

function mapImportError(error: ImportError): NextResponse {
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

function validateExcelUpload(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = EXCEL_CONFIG.allowedExtensions.some((ext) =>
    lowerName.endsWith(ext),
  );

  if (!hasValidExtension) {
    return "Formato no permitido. Use .xlsx o .xlsm.";
  }

  if (file.size > EXCEL_CONFIG.maxSizeBytes) {
    return "El archivo supera el tamaño máximo permitido (50 MB).";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo en el campo file.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const validationError = validateExcelUpload(file);
    if (validationError) {
      return NextResponse.json(
        { error: validationError, code: "INVALID_FILE" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await catalogImportService.uploadAndCreateJob({
      buffer,
      originalFilename: file.name,
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (error instanceof AuthError && error.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }

    if (error instanceof ImportError) {
      return mapImportError(error);
    }

    throw error;
  }
}
