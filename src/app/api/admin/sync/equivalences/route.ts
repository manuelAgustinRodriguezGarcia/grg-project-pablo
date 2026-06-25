import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { OfflineSyncError } from "@/server/services/offline-sync.errors";
import { offlineSyncService } from "@/server/services/offline-sync.service";
import { offlineCatalogIdQuerySchema } from "@/features/offline/schemas/offline-sync.schemas";

function mapOfflineSyncError(error: OfflineSyncError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = offlineCatalogIdQuerySchema.safeParse({
      catalogId: searchParams.get("catalogId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "catalogId requerido.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const bundle = await offlineSyncService.getEquivalencesBundle(parsed.data.catalogId);
    return NextResponse.json(bundle);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof OfflineSyncError ? mapOfflineSyncError(err) : null,
    );
  }
}
