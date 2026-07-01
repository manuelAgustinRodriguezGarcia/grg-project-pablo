import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";
import { BUCKET_CONFIGS } from "@/server/storage/config";
import { resolveExcelContentType } from "@/server/storage/resolve-excel-content-type";
import { getFileExtension } from "@/server/storage/sanitize-filename";
import { STORAGE_BUCKETS } from "@/server/storage/types";

const EXCEL_CONFIG = BUCKET_CONFIGS[STORAGE_BUCKETS.EXCEL_ORIGINALS];
const TEMP_CONFIG = BUCKET_CONFIGS[STORAGE_BUCKETS.TEMP_IMPORTS];

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

function validateOptionalImageFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  const isZip = extension === ".zip";
  const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(extension);

  if (!isZip && !isImage) {
    return `Formato no permitido: ${file.name}`;
  }

  if (file.size > TEMP_CONFIG.maxSizeBytes) {
    return `El archivo ${file.name} supera el tamaño máximo permitido.`;
  }

  return null;
}

async function collectOptionalImages(
  formData: FormData,
): Promise<Array<{ buffer: Buffer; originalFilename: string; contentType: string; isZip: boolean }>> {
  const files: Array<{
    buffer: Buffer;
    originalFilename: string;
    contentType: string;
    isZip: boolean;
  }> = [];

  const zip = formData.get("imagesZip");
  if (zip instanceof File) {
    const validationError = validateOptionalImageFile(zip);
    if (validationError) {
      throw new ImportError(validationError, "INVALID_FILE");
    }

    files.push({
      buffer: Buffer.from(await zip.arrayBuffer()),
      originalFilename: zip.name,
      contentType: zip.type || "application/zip",
      isZip: true,
    });
  }

  const looseImages = formData.getAll("images");
  for (const entry of looseImages) {
    if (!(entry instanceof File)) {
      continue;
    }

    const validationError = validateOptionalImageFile(entry);
    if (validationError) {
      throw new ImportError(validationError, "INVALID_FILE");
    }

    files.push({
      buffer: Buffer.from(await entry.arrayBuffer()),
      originalFilename: entry.name,
      contentType: entry.type || "image/jpeg",
      isZip: false,
    });
  }

  return files;
}

export async function POST(request: Request) {
  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo leer el archivo enviado. Si el Excel pesa más de 50 MB, reduzca su tamaño o quite imágenes embebidas.",
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 },
      );
    }

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
      contentType: resolveExcelContentType(file.name, file.type),
    });

    const optionalImages = await collectOptionalImages(formData);
    if (optionalImages.length > 0) {
      await catalogImportService.uploadImportImages(result.jobId, optionalImages);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
