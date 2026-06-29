import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceColumnConfigError } from "@/server/services/price-column-config.errors";
import { PriceListError } from "@/server/services/price-list.errors";
import { priceColumnConfigService } from "@/server/services/price-column-config.service";
import { reorderPriceColumnsSchema } from "@/features/prices/schemas/price-list.schemas";

type RouteContext = {
  params: Promise<{ priceListId: string }>;
};

function mapDomainError(
  error: PriceColumnConfigError | PriceListError,
): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const body = await request.json();
    const parsed = reorderPriceColumnsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    await priceColumnConfigService.reorderColumns({
      priceListId,
      items: parsed.data.items,
    });

    const columns = await priceColumnConfigService.listColumns(priceListId);
    return NextResponse.json({ columns });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceColumnConfigError || err instanceof PriceListError
        ? mapDomainError(err)
        : null,
    );
  }
}
