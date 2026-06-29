import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { PriceColumnConfigError } from "@/server/services/price-column-config.errors";
import { priceColumnConfigService } from "@/server/services/price-column-config.service";

type RouteContext = {
  params: Promise<{ priceListId: string; columnId: string }>;
};

function mapDomainError(error: PriceColumnConfigError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { columnId } = await context.params;
    await priceColumnConfigService.deleteColumn(columnId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof PriceColumnConfigError ? mapDomainError(err) : null,
    );
  }
}
