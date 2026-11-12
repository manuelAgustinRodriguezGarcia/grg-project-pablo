import { binaryFileResponse } from "@/server/api/binary-file-response";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { mapBillingLibroIvaArchiveError } from "@/server/api/billing-libro-iva-archive-error";
import { billingLibroIvaArchiveService } from "@/server/services/billing-libro-iva-archive.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ archiveId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { archiveId } = await context.params;
    const file = await billingLibroIvaArchiveService.downloadArchive(archiveId);
    return binaryFileResponse(
      file.bytes,
      file.filename,
      file.contentType,
      "attachment",
    );
  } catch (error) {
    return handleAdminApiError(error, mapBillingLibroIvaArchiveError);
  }
}
