import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceListError } from "@/server/services/price-list.errors";
import { priceListService } from "@/server/services/price-list.service";

type RouteContext = {
  params: Promise<{ priceListId: string }>;
};

function mapPriceListError(error: PriceListError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code === "PRICE_LIST_NOT_FOUND" ? 404 : 400 },
  );
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const result = await priceListService.clearPriceList(priceListId);
    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceListError ? mapPriceListError(err) : null,
    );
  }
}
