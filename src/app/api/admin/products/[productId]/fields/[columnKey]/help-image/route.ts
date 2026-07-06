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
    const formData = await request.formData();
    const file = formData.get("file");
    const altTextRaw = formData.get("altText");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo en el campo file.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const annotation = await productFieldAnnotationService.uploadFieldHelpImage({
      productId,
      columnInternalKey: decodeURIComponent(columnKey),
      buffer,
      originalFilename: file.name,
      altText: typeof altTextRaw === "string" ? altTextRaw : undefined,
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { productId, columnKey } = await context.params;
    const annotation = await productFieldAnnotationService.deleteFieldHelpImage(
      productId,
      decodeURIComponent(columnKey),
    );

    return NextResponse.json({ annotation });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductFieldAnnotationError) {
        return mapFieldAnnotationError(domainError);
      }

      return null;
    });
  }
}
