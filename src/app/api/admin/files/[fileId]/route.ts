import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { uploadedFileDeleteBodySchema } from "@/features/files/schemas/uploaded-file.schemas";
import { uploadedFileService } from "@/server/services/uploaded-file.service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const detail = await uploadedFileService.getFileDetail(fileId);
    return NextResponse.json(detail);
  } catch (error) {
    return handleAdminApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = uploadedFileDeleteBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const result = await uploadedFileService.deleteFile(fileId, {
      confirmed: parsed.data.confirmed,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
