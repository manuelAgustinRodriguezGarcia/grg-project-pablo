import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductFieldAnnotationError } from "@/server/services/product-field-annotation.errors";
import { productFieldAnnotationService } from "@/server/services/product-field-annotation.service";

type RouteContext = {
  params: Promise<{ productId: string; columnKey: string }>;
};

function mapFieldAnnotationError(error: ProductFieldAnnotationError): NextResponse {
  const status =
    error.code === "PRODUCT_NOT_FOUND" || error.code === "FIELD_HELP_IMAGE_NOT_FOUND"
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { productId, columnKey } = await context.params;
    const body = (await request.json()) as {
      originalFilename?: unknown;
      contentType?: unknown;
      sizeBytes?: unknown;
      altText?: unknown;
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

    const result = await productFieldAnnotationService.beginFieldHelpImageDirectUpload({
      productId,
      columnInternalKey: decodeURIComponent(columnKey),
      originalFilename: body.originalFilename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      altText: typeof body.altText === "string" ? body.altText : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductFieldAnnotationError) {
        return mapFieldAnnotationError(domainError);
      }
      return null;
    });
  }
}
