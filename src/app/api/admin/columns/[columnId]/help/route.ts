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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { columnId } = await context.params;
    const item = await columnHelpService.getColumnHelp(columnId);
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
