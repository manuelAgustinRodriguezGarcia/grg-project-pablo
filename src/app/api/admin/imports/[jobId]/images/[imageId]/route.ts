import { NextResponse } from "next/server";
import { z } from "zod";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ProductImageError } from "@/server/services/product-image.errors";
import { productImageService } from "@/server/services/product-image.service";

type RouteContext = {
  params: Promise<{ jobId: string; imageId: string }>;
};

const patchSchema = z
  .object({
    productId: z.string().min(1).optional(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    label: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      value.productId !== undefined ||
      value.isPrimary !== undefined ||
      value.sortOrder !== undefined ||
      value.label !== undefined,
    { message: "Debe enviar al menos un campo para actualizar." },
  );

function mapProductImageError(error: ProductImageError): NextResponse {
  const status =
    error.code === "IMAGE_NOT_FOUND" || error.code === "PRODUCT_NOT_FOUND"
      ? 404
      : 400;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { jobId, imageId } = await context.params;
    const job = await catalogImportService.getJob(jobId);

    if (!job.folderId) {
      return NextResponse.json(
        { error: "La importación no tiene carpeta destino.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    if (parsed.data.productId) {
      const associated = await productImageService.associateWithProduct({
        importJobId: jobId,
        imageId,
        productId: parsed.data.productId,
        folderId: job.folderId,
      });

      if (
        parsed.data.isPrimary !== undefined ||
        parsed.data.sortOrder !== undefined ||
        parsed.data.label !== undefined
      ) {
        const updated = await productImageService.updateImage({
          importJobId: jobId,
          imageId,
          isPrimary: parsed.data.isPrimary,
          sortOrder: parsed.data.sortOrder,
          label: parsed.data.label,
        });
        return NextResponse.json(updated);
      }

      return NextResponse.json(associated);
    }

    const updated = await productImageService.updateImage({
      importJobId: jobId,
      imageId,
      isPrimary: parsed.data.isPrimary,
      sortOrder: parsed.data.sortOrder,
      label: parsed.data.label,
    });

    return NextResponse.json(updated);
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
    const { jobId, imageId } = await context.params;
    await catalogImportService.getJob(jobId);
    await productImageService.softDeleteImage(jobId, imageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAdminApiError(error, (domainError) => {
      if (domainError instanceof ProductImageError) {
        const status = domainError.code === "IMAGE_NOT_FOUND" ? 404 : 400;
        return NextResponse.json(
          { error: domainError.message, code: domainError.code },
          { status },
        );
      }

      return null;
    });
  }
}
