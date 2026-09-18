import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";
import { folderProductListQuerySchema } from "@/features/catalog/schemas/search.schemas";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

const locateQuerySchema = folderProductListQuerySchema
  .pick({ pageSize: true, filters: true })
  .extend({
    productId: z.string().trim().min(1),
  });

export async function GET(request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = locateQuerySchema.safeParse({
      productId: searchParams.get("productId") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
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

    const result = await productService.locateProductPageInFolder({
      folderId,
      productId: parsed.data.productId,
      pageSize: parsed.data.pageSize,
      filters: parsed.data.filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        const status =
          domainError.code === "VALIDATION_ERROR" ? 400 : 404;
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
