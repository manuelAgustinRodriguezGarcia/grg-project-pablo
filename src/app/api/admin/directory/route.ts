import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { directoryService } from "@/server/services/directory.service";

export async function GET() {
  try {
    const directory = await directoryService.getDirectory();
    return NextResponse.json(directory);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
