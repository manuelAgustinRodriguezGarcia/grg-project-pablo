import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { mapBillingLibroIvaArchiveError } from "@/server/api/billing-libro-iva-archive-error";
import { billingLibroIvaArchiveService } from "@/server/services/billing-libro-iva-archive.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ids = new URL(request.url).searchParams.getAll("id");
    const files = await billingLibroIvaArchiveService.listFilePresence(ids);
    return NextResponse.json({ files });
  } catch (error) {
    return handleAdminApiError(error, mapBillingLibroIvaArchiveError);
  }
}
