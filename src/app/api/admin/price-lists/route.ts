import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceListError } from "@/server/services/price-list.errors";
import { priceListService } from "@/server/services/price-list.service";
import { createPriceListSchema } from "@/features/prices/schemas/price-list.schemas";
import { toPriceListListItem } from "@/features/prices/types/price-list.types";

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

export async function GET() {
  try {
    const lists = await priceListService.listPriceLists();
    return NextResponse.json({
      priceLists: lists.map(toPriceListListItem),
    });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPriceListSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const list = await priceListService.createPriceList(parsed.data);
    return NextResponse.json(toPriceListListItem(list), { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}
