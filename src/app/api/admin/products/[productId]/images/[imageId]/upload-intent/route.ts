import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";

type RouteContext = {
  params: Promise<{ productId: string; imageId: string }>;
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
    const { productId, imageId } = await context.params;
    const body = (await request.json()) as {
      originalFilename?: unknown;
      contentType?: unknown;
      sizeBytes?: unknown;
    };

    if (
      typeof body.originalFilename !== "string" ||
      typeof body.contentType !== "string" ||
      typeof body.sizeBytes !== "number"
    ) {
      return NextResponse.json(
        { error: "Metadatos de imagen inválidos.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await productImageService.beginReplaceManualImageDirectUpload({
      productId,
      imageId,
      originalFilename: body.originalFilename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }
      return null;
    });
  }
}
