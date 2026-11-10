import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { priceItemPositionQuerySchema } from "@/features/prices/schemas/price-list.schemas";
import { PriceItemError } from "@/server/services/price-item.errors";
import { PriceListError } from "@/server/services/price-list.errors";
import { VisibilityError } from "@/server/services/visibility.errors";
import { priceItemService } from "@/server/services/price-item.service";

type RouteContext = {
  params: Promise<{ priceListId: string; itemId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { priceListId, itemId } = await context.params;
    const { searchParams } = new URL(request.url);
    const parsed = priceItemPositionQuerySchema.safeParse({
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

    const result = await priceItemService.locateItemPage(
      priceListId,
      itemId,
      parsed.data.pageSize,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceItemError ||
      err instanceof PriceListError ||
      err instanceof VisibilityError
        ? NextResponse.json({ error: err.message, code: err.code }, { status: 404 })
        : null,
    );
  }
}
