import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const product = await productService.duplicateProduct(productId);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        const status = domainError.code === "PRODUCT_NOT_FOUND" ? 404 : 400;
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
