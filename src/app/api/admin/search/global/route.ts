import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { globalSearchQuerySchema } from "@/features/catalog/schemas/search.schemas";
import { SearchError } from "@/server/search/search.errors";
import { searchService } from "@/server/search/search.service";

function mapSearchError(error: SearchError): NextResponse {
  const status = error.code === "VALIDATION_ERROR" ? 400 : 404;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = globalSearchQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      catalogId: searchParams.get("catalogId") ?? undefined,
      folderId: searchParams.get("folderId") ?? undefined,
      globalFieldKey: searchParams.get("globalFieldKey") ?? undefined,
      globalFieldValue: searchParams.get("globalFieldValue") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Parámetros inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const result = await searchService.searchGlobal({
      query: parsed.data.q ?? "",
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      scope: {
        catalogId: parsed.data.catalogId,
        folderId: parsed.data.folderId,
      },
      globalFieldFilter:
        parsed.data.globalFieldKey && parsed.data.globalFieldValue
          ? {
              globalFieldKey: parsed.data.globalFieldKey,
              value: parsed.data.globalFieldValue,
            }
          : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof SearchError) {
        return mapSearchError(domainError);
      }

      return null;
    });
  }
}
