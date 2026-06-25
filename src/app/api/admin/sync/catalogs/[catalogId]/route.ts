import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { OfflineSyncError } from "@/server/services/offline-sync.errors";
import { offlineSyncService } from "@/server/services/offline-sync.service";

type RouteContext = {
  params: Promise<{ catalogId: string }>;
};

function mapOfflineSyncError(error: OfflineSyncError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { catalogId } = await context.params;
    const bundle = await offlineSyncService.getCatalogBundle(catalogId);
    return NextResponse.json(bundle);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof OfflineSyncError ? mapOfflineSyncError(err) : null,
    );
  }
}
