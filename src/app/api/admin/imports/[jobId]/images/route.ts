import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { BUCKET_CONFIGS } from "@/server/storage/config";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { getFileExtension } from "@/server/storage/sanitize-filename";

const TEMP_CONFIG = BUCKET_CONFIGS[STORAGE_BUCKETS.TEMP_IMPORTS];

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const formData = await request.formData();
    const files: Array<{
      buffer: Buffer;
      originalFilename: string;
      contentType: string;
      isZip: boolean;
    }> = [];

    const zip = formData.get("imagesZip");
    if (zip instanceof File) {
      if (getFileExtension(zip.name) !== ".zip") {
        return NextResponse.json(
          { error: "imagesZip debe ser un archivo .zip.", code: "INVALID_FILE" },
          { status: 400 },
        );
      }

      if (zip.size > TEMP_CONFIG.maxSizeBytes) {
        return NextResponse.json(
          { error: "El ZIP supera el tamaño máximo permitido (50 MB).", code: "INVALID_FILE" },
          { status: 400 },
        );
      }

      files.push({
        buffer: Buffer.from(await zip.arrayBuffer()),
        originalFilename: zip.name,
        contentType: zip.type || "application/zip",
        isZip: true,
      });
    }

    for (const entry of formData.getAll("images")) {
      if (!(entry instanceof File)) {
        continue;
      }

      const extension = getFileExtension(entry.name);
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
        return NextResponse.json(
          { error: `Formato no permitido: ${entry.name}`, code: "INVALID_FILE" },
          { status: 400 },
        );
      }

      if (entry.size > TEMP_CONFIG.maxSizeBytes) {
        return NextResponse.json(
          { error: `Archivo demasiado grande: ${entry.name}`, code: "INVALID_FILE" },
          { status: 400 },
        );
      }

      files.push({
        buffer: Buffer.from(await entry.arrayBuffer()),
        originalFilename: entry.name,
        contentType: entry.type || "image/jpeg",
        isZip: false,
      });
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Debe enviar imagesZip y/o uno o más archivos en images.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    await catalogImportService.uploadImportImages(jobId, files);
    const job = await catalogImportService.getJob(jobId);

    return NextResponse.json({ jobId, status: job.status });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
