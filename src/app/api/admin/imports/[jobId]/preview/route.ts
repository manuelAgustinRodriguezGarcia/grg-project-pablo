import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import type { MappedProductRow } from "@/server/importers";
import type { ImportPreviewSummary } from "@/features/imports/types/import-job.types";
import { importPreviewQuerySchema } from "@/features/imports/schemas/import.schemas";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = importPreviewQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
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

    const job = await catalogImportService.getJob(jobId);

    if (!job.preview) {
      return NextResponse.json(
        { error: "Vista previa no disponible.", code: "INVALID_STATE" },
        { status: 409 },
      );
    }

    const products = job.preview.recognizedProducts as MappedProductRow[];
    const matchedProducts = job.preview.matchedProducts as MappedProductRow[];
    const summary = job.preview.summary as ImportPreviewSummary;
    const page = parsed.data.page;
    const pageSize = parsed.data.pageSize;
    const total = products.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;

    return NextResponse.json({
      summary,
      products: products.slice(start, start + pageSize),
      matchedProducts,
      warnings: job.preview.warnings,
      errors: job.preview.errors,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
