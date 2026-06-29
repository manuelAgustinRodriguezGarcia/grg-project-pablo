import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceItemError } from "@/server/services/price-item.errors";
import { PriceListError } from "@/server/services/price-list.errors";
import { VisibilityError } from "@/server/services/visibility.errors";
import { priceItemService } from "@/server/services/price-item.service";
import { updatePriceItemSchema } from "@/features/prices/schemas/price-list.schemas";

type RouteContext = {
  params: Promise<{ priceListId: string; itemId: string }>;
};

function mapDomainError(error: PriceItemError | PriceListError | VisibilityError): NextResponse {
  const status =
    error instanceof VisibilityError || error.code.includes("NOT_FOUND")
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const body = await request.json();
    const parsed = updatePriceItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const item = await priceItemService.updateItem(itemId, parsed.data.values);
    return NextResponse.json(item);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceItemError ||
      err instanceof PriceListError ||
      err instanceof VisibilityError
        ? mapDomainError(err)
        : null,
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    await priceItemService.deleteItem(itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceItemError ||
      err instanceof PriceListError ||
      err instanceof VisibilityError
        ? mapDomainError(err)
        : null,
    );
  }
}
