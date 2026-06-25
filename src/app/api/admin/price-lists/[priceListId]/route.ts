import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceListError } from "@/server/services/price-list.errors";
import { priceListService } from "@/server/services/price-list.service";
import { updatePriceListSchema } from "@/features/prices/schemas/price-list.schemas";
import { toPriceListListItem } from "@/features/prices/types/price-list.types";

type RouteContext = {
  params: Promise<{ priceListId: string }>;
};

function mapPriceListError(error: PriceListError): NextResponse {
  const status =
    error.code === "PRICE_LIST_NOT_FOUND"
      ? 404
      : error.code === "PRICE_LIST_DUPLICATE_NAME"
        ? 409
        : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const list = await priceListService.getPriceList(priceListId);
    return NextResponse.json(toPriceListListItem(list));
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const body = await request.json();
    const parsed = updatePriceListSchema.safeParse({ ...body, id: priceListId });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const list = await priceListService.updatePriceList(parsed.data);
    return NextResponse.json(toPriceListListItem(list));
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    await priceListService.deletePriceList(priceListId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}
