import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { uploadedFileListQuerySchema } from "@/features/files/schemas/uploaded-file.schemas";
import { uploadedFileService } from "@/server/services/uploaded-file.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = uploadedFileListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      q: searchParams.get("q") ?? undefined,
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

    const result = await uploadedFileService.listFiles({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      query: parsed.data.q,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
