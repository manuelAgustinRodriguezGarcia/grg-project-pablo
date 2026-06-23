import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { CatalogError } from "@/server/services/catalog.errors";
import { navigationService } from "@/server/services/navigation.service";

type RouteContext = {
  params: Promise<{ catalogId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { catalogId } = await context.params;
    const navigation = await navigationService.getCatalogNavigation(catalogId);
    return NextResponse.json(navigation);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (
        domainError instanceof CatalogError &&
        domainError.code === "CATALOG_NOT_FOUND"
      ) {
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status: 404 },
        );
      }

      return null;
    });
  }
}
