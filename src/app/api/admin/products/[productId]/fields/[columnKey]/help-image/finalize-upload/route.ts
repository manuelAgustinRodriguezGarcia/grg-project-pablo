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
      stagingPath?: unknown;
      originalFilename?: unknown;
      altText?: unknown;
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

    const annotation =
      await productFieldAnnotationService.finalizeFieldHelpImageDirectUpload({
        productId,
        columnInternalKey: decodeURIComponent(columnKey),
        stagingPath: body.stagingPath,
        originalFilename: body.originalFilename,
        altText: typeof body.altText === "string" ? body.altText : undefined,
      });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductFieldAnnotationError) {
        return mapFieldAnnotationError(domainError);
      }
      return null;
    });
  }
}
