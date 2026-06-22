import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await catalogImportService.getJob(jobId);

    if (job.status !== "PUBLISHED" && job.status !== "FAILED") {
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
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (error instanceof ImportError) {
      const status = error.code === "IMPORT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    throw error;
  }
}
