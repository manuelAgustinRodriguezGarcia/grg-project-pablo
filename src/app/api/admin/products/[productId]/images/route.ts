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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const images = await productImageService.getProductImages(productId);
    return NextResponse.json({ productId, images });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }

      return null;
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { productId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debe enviar un archivo en el campo file.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const isPrimaryRaw = formData.get("isPrimary");
    const sortOrderRaw = formData.get("sortOrder");
    const labelRaw = formData.get("label");

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await productImageService.uploadManualImage({
      productId,
      buffer,
      originalFilename: file.name,
      isPrimary: isPrimaryRaw === "true" ? true : undefined,
      sortOrder:
        typeof sortOrderRaw === "string" && sortOrderRaw.length > 0
          ? Number.parseInt(sortOrderRaw, 10)
          : undefined,
      label: typeof labelRaw === "string" ? labelRaw : undefined,
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
