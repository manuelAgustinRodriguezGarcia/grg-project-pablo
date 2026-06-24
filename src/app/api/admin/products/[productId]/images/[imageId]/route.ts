import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";
import { updateProductImageBodySchema } from "@/features/records/schemas/product.schemas";

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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { productId, imageId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Debe enviar un archivo en el campo file.", code: "VALIDATION_ERROR" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const image = await productImageService.replaceManualImage({
        productId,
        imageId,
        buffer,
        originalFilename: file.name,
      });

      return NextResponse.json(image);
    }

    const body: unknown = await request.json();
    const parsed = updateProductImageBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const image = await productImageService.updateProductImage({
      productId,
      imageId,
      isPrimary: parsed.data.isPrimary,
      sortOrder: parsed.data.sortOrder,
      label: parsed.data.label,
    });

    return NextResponse.json(image);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }

      return null;
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { productId, imageId } = await context.params;
    await productImageService.deleteProductImage(productId, imageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }

      return null;
    });
  }
}
