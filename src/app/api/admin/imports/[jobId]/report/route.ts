import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await catalogImportService.getJob(jobId);

    if (
      job.status !== "PUBLISHED" &&
      job.status !== "FAILED" &&
      job.status !== "PENDING_REVIEW"
    ) {
      return NextResponse.json(
        {
          error: "El informe solo está disponible para importaciones finalizadas.",
          code: "INVALID_STATE",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      report: job.resultados,
      errorMessage: job.errorMessage,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
