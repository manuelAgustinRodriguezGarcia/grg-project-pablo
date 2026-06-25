import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { OfflineSyncError } from "@/server/services/offline-sync.errors";
import { offlineSyncService } from "@/server/services/offline-sync.service";
import { offlineFolderCursorSchema } from "@/features/offline/schemas/offline-sync.schemas";

type RouteContext = {
  params: Promise<{ priceListId: string }>;
};

function mapOfflineSyncError(error: OfflineSyncError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.code.includes("NOT_FOUND") ? 404 : 400 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { priceListId } = await context.params;
    const { searchParams } = new URL(request.url);

    const parsed = offlineFolderCursorSchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      chunkSize: searchParams.get("chunkSize") ?? undefined,
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

    const bundle = await offlineSyncService.getPriceListBundle(
      priceListId,
      parsed.data.cursor,
      parsed.data.chunkSize,
    );

    return NextResponse.json(bundle);
  } catch (error) {
    return handleAdminApiError(error, (err) =>
      err instanceof OfflineSyncError ? mapOfflineSyncError(err) : null,
    );
  }
}
