import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      excel?: ExternalMetaBody;
      externals?: ExternalMetaBody[];
    };

    if (
      !body.excel ||
      typeof body.excel.originalFilename !== "string" ||
      typeof body.excel.contentType !== "string" ||
      typeof body.excel.sizeBytes !== "number"
    ) {
      return NextResponse.json(
        { error: "Debe enviar metadatos del Excel.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const externals = (body.externals ?? []).map(parseExternalMeta);

    const result = await catalogImportService.beginDirectUpload({
      excel: {
        originalFilename: body.excel.originalFilename,
        contentType: body.excel.contentType,
        sizeBytes: body.excel.sizeBytes,
      },
      externals,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
