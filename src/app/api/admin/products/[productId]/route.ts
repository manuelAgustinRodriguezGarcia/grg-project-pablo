import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductError } from "@/server/services/product.errors";
import { productService } from "@/server/services/product.service";
import { updateProductBodySchema } from "@/features/records/schemas/product.schemas";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

function mapProductError(error: ProductError): NextResponse {
  const status =
    error.code === "VALIDATION_ERROR" || error.code === "COLUMN_NOT_EDITABLE"
      ? 400
      : 404;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const product = await productService.getProduct(productId);
    return NextResponse.json(product);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        return mapProductError(domainError);
      }

      return null;
    });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateProductBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const product = await productService.updateProduct({
      productId,
      values: parsed.data.values,
      fieldAnnotations: parsed.data.fieldAnnotations,
    });

    return NextResponse.json(product);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        return mapProductError(domainError);
      }

      return null;
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    await productService.deleteProduct(productId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductError) {
        return mapProductError(domainError);
      }

      return null;
    });
  }
}
