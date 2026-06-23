import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { catalogImportService } from "@/server/services/catalog-import.service";
import { toImportSheetItems } from "@/features/imports/types/import-job.types";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await catalogImportService.getJob(jobId);

    return NextResponse.json({
      jobId: job.id,
      sheets: toImportSheetItems(job),
    });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
