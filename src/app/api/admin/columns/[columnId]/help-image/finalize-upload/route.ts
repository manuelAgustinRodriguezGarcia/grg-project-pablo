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
      stagingPath?: unknown;
      originalFilename?: unknown;
      altText?: unknown;
    };

    if (
      typeof body.stagingPath !== "string" ||
      typeof body.originalFilename !== "string"
    ) {
      return NextResponse.json(
        { error: "Metadatos de finalización inválidos.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const item = await columnHelpService.finalizeHelpImageDirectUpload({
      columnId,
      stagingPath: body.stagingPath,
      originalFilename: body.originalFilename,
      altText: typeof body.altText === "string" ? body.altText : undefined,
    });

    return NextResponse.json({ column: item }, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ColumnHelpError) {
        return mapColumnHelpError(domainError);
      }
      return null;
    });
  }
}
