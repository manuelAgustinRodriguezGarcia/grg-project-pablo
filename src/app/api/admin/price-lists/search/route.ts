import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { priceGlobalSearchQuerySchema } from "@/features/prices/schemas/price-list.schemas";
import { priceItemService } from "@/server/services/price-item.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = priceGlobalSearchQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
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

    const result = await priceItemService.searchAllLists(parsed.data.q);
    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, () => null);
  }
}
