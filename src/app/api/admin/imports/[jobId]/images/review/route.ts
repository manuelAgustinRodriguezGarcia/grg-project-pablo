import { NextResponse } from "next/server";
import { z } from "zod";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { productImageService } from "@/server/services/product-image.service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z
    .enum([
      "ASSOCIATED_AUTO",
      "ASSOCIATED_MANUAL",
      "PENDING_REVIEW",
      "FILE_NOT_FOUND",
      "AMBIGUOUS",
      "DUPLICATE_NAME",
      "FORMAT_REJECTED",
      "DELETED",
    ])
    .optional(),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    await catalogImportService.getJob(jobId);

    const { searchParams } = new URL(request.url);
    const parsed = reviewQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
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

    const result = await productImageService.listImportReview(jobId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      status: parsed.data.status,
    });

    return NextResponse.json({
      jobId,
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
