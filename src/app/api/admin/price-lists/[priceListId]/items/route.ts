import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceItemError } from "@/server/services/price-item.errors";
import { PriceListError } from "@/server/services/price-list.errors";
import { VisibilityError } from "@/server/services/visibility.errors";
import { priceItemService } from "@/server/services/price-item.service";
import {
  createPriceItemSchema,
  priceItemListQuerySchema,
} from "@/features/prices/schemas/price-list.schemas";

type RouteContext = {
  params: Promise<{ priceListId: string }>;
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = priceItemListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      filters: searchParams.get("filters") ?? undefined,
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

    const table = await priceItemService.listItems({
      priceListId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      query: parsed.data.q,
      filters: parsed.data.filters,
    });

    return NextResponse.json(table);
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const body = await request.json();
    const parsed = createPriceItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const item = await priceItemService.createItem(priceListId, parsed.data.values);
    return NextResponse.json(item, { status: 201 });
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
