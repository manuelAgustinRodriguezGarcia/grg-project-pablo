import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { uploadedFileReportQuerySchema } from "@/features/files/schemas/uploaded-file.schemas";
import { uploadedFileService } from "@/server/services/uploaded-file.service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = uploadedFileReportQuerySchema.safeParse({
      jobId: searchParams.get("jobId") ?? undefined,
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

    const result = await uploadedFileService.getReport(
      fileId,
      parsed.data.jobId,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
