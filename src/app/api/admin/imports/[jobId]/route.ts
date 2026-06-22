import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { ImportError } from "@/server/services/import.errors";
import { toImportJobDetail } from "@/features/imports/types/import-job.types";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function handleError(error: unknown): NextResponse {
  if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (error instanceof ImportError) {
    const status = error.code === "IMPORT_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  throw error;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await catalogImportService.getJob(jobId);
    return NextResponse.json(toImportJobDetail(job));
  } catch (error) {
    return handleError(error);
  }
}
