import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";
import { productPaginationQuerySchema } from "@/features/catalog/schemas/product.schemas";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { folderId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = productPaginationQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
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

    const table = await productService.listProductsByFolder({
      folderId,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return NextResponse.json(table);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        const status = domainError.code === "VALIDATION_ERROR" ? 400 : 404;
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
