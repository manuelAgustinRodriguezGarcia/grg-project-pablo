import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { mapBillingLibroIvaArchiveError } from "@/server/api/billing-libro-iva-archive-error";
import { billingLibroIvaArchiveService } from "@/server/services/billing-libro-iva-archive.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const archives = await billingLibroIvaArchiveService.listArchives({
      year: url.searchParams.get("year"),
      month: url.searchParams.get("month"),
    });

    return NextResponse.json({ archives });
  } catch (error) {
    return handleAdminApiError(error, mapBillingLibroIvaArchiveError);
  }
}
