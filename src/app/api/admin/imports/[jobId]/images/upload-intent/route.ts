import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type ExternalMetaBody = {
  originalFilename?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
  isZip?: unknown;
};

function parseExternalMeta(entry: ExternalMetaBody) {
  if (
    typeof entry.originalFilename !== "string" ||
    typeof entry.contentType !== "string" ||
    typeof entry.sizeBytes !== "number" ||
    typeof entry.isZip !== "boolean"
  ) {
    throw new ImportError("Metadatos de imagen externa inválidos.", "VALIDATION_ERROR");
  }

  return {
    originalFilename: entry.originalFilename,
    contentType: entry.contentType,
    sizeBytes: entry.sizeBytes,
    isZip: entry.isZip,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json()) as { externals?: ExternalMetaBody[] };
    const externals = (body.externals ?? []).map(parseExternalMeta);

    if (externals.length === 0) {
      return NextResponse.json(
        {
          error: "Debe enviar al menos un archivo externo.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const result = await catalogImportService.beginExternalImagesDirectUpload(
      jobId,
      externals,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
