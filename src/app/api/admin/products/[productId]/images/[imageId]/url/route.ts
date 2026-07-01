import { NextResponse } from "next/server";
import { z } from "zod";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";

type RouteContext = {
  params: Promise<{ productId: string; imageId: string }>;
};

const imageUrlQuerySchema = z.object({
  size: z.enum(["full", "thumb"]).default("full"),
});

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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { productId, imageId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = imageUrlQuerySchema.safeParse({
      size: searchParams.get("size") ?? undefined,
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

    const result = await productImageService.getProductImageSignedUrl(
      productId,
      imageId,
      parsed.data.size,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        return mapProductImageError(domainError);
      }

      return null;
    });
  }
}
