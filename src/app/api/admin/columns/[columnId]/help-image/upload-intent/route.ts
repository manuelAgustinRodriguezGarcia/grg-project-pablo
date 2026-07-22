import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ColumnHelpError } from "@/server/services/column-help.errors";
import { columnHelpService } from "@/server/services/column-help.service";

type RouteContext = {
  params: Promise<{ columnId: string }>;
};

function mapColumnHelpError(error: ColumnHelpError): NextResponse {
  const status =
    error.code === "COLUMN_NOT_FOUND" ||
    error.code === "FOLDER_NOT_FOUND" ||
    error.code === "CATALOG_NOT_FOUND" ||
    error.code === "HELP_IMAGE_NOT_FOUND"
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { columnId } = await context.params;
    const body = (await request.json()) as {
      originalFilename?: unknown;
      contentType?: unknown;
      sizeBytes?: unknown;
      altText?: unknown;
    };

    if (
      typeof body.originalFilename !== "string" ||
      typeof body.contentType !== "string" ||
      typeof body.sizeBytes !== "number"
    ) {
      return NextResponse.json(
        { error: "Metadatos de imagen inválidos.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await columnHelpService.beginHelpImageDirectUpload({
      columnId,
      originalFilename: body.originalFilename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      altText: typeof body.altText === "string" ? body.altText : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ColumnHelpError) {
        return mapColumnHelpError(domainError);
      }
      return null;
    });
  }
}
