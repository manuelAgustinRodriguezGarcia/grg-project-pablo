import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { OfflineSyncError } from "@/server/services/offline-sync.errors";
import { offlineSyncService } from "@/server/services/offline-sync.service";
import { offlineDeviceIdSchema } from "@/features/offline/schemas/offline-sync.schemas";

function mapOfflineSyncError(error: OfflineSyncError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = offlineDeviceIdSchema.safeParse({
      deviceId: searchParams.get("deviceId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "deviceId requerido.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const manifest = await offlineSyncService.getManifest(parsed.data.deviceId);
    return NextResponse.json(manifest);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof OfflineSyncError ? mapOfflineSyncError(err) : null,
    );
  }
}
