import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogSearchQuerySchema } from "@/features/catalog/schemas/search.schemas";
import { SearchError } from "@/server/search/search.errors";
import { searchService } from "@/server/search/search.service";

type RouteContext = {
  params: Promise<{ catalogId: string }>;
};

function mapSearchError(error: SearchError): NextResponse {
  const status = error.code === "VALIDATION_ERROR" ? 400 : 404;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { catalogId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = catalogSearchQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
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

    const result = await searchService.searchInCatalog({
      catalogId,
      query: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
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
