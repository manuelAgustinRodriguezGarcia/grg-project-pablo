import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { uploadedFileService } from "@/server/services/uploaded-file.service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const result = await uploadedFileService.reprocess(fileId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAdminApiError(error);
  }
}
