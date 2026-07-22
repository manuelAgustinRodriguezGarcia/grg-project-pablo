import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type ExternalFinalizeBody = {
  path?: unknown;
  originalFilename?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
  isZip?: unknown;
};

function parseExternal(entry: ExternalFinalizeBody) {
  if (
    typeof entry.path !== "string" ||
    typeof entry.originalFilename !== "string" ||
    typeof entry.contentType !== "string" ||
    typeof entry.sizeBytes !== "number" ||
    typeof entry.isZip !== "boolean"
  ) {
    throw new ImportError("Metadatos de finalización inválidos.", "VALIDATION_ERROR");
  }

  return {
    path: entry.path,
    originalFilename: entry.originalFilename,
    contentType: entry.contentType,
    sizeBytes: entry.sizeBytes,
    isZip: entry.isZip,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      externals?: ExternalFinalizeBody[];
    };

    const externals = (body.externals ?? []).map(parseExternal);
    const result = await catalogImportService.finalizeDirectUpload(jobId, {
      externals,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
