import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { offlineSyncService } from "@/server/services/offline-sync.service";

export async function GET() {
  try {
    const manifest = await offlineSyncService.getThumbnailsManifest();
    return NextResponse.json(manifest);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
