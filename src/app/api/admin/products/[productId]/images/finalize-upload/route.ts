import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

function mapProductImageError(error: ProductImageError): NextResponse {
  const status =
    error.code === "PRODUCT_NOT_FOUND" || error.code === "IMAGE_NOT_FOUND"
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const body = (await request.json()) as {
      stagingPath?: unknown;
      originalFilename?: unknown;
      isPrimary?: unknown;
      sortOrder?: unknown;
      label?: unknown;
    };

    if (
      typeof body.stagingPath !== "string" ||
      typeof body.originalFilename !== "string"
    ) {
      return NextResponse.json(
        { error: "Metadatos de finalización inválidos.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const image = await productImageService.finalizeManualImageDirectUpload({
      productId,
      stagingPath: body.stagingPath,
      originalFilename: body.originalFilename,
      isPrimary: body.isPrimary === true ? true : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }
      return null;
    });
  }
}
