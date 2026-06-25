import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { uploadedFileService } from "@/server/services/uploaded-file.service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const result = await uploadedFileService.getDownloadUrl(fileId);
    return NextResponse.json(result);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
