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
    const formData = await request.formData();
    const file = formData.get("file");
    const altTextRaw = formData.get("altText");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo en el campo file.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await columnHelpService.uploadHelpImage({
      columnId,
      buffer,
      originalFilename: file.name,
      altText: typeof altTextRaw === "string" ? altTextRaw : undefined,
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { columnId } = await context.params;
    const item = await columnHelpService.deleteHelpImage(columnId);
    return NextResponse.json({ column: item });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ColumnHelpError) {
        return mapColumnHelpError(domainError);
      }

      return null;
    });
  }
}
