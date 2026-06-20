import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";
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
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (error instanceof CatalogError && error.code === "CATALOG_NOT_FOUND") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 404 },
      );
    }

    throw error;
  }
}
