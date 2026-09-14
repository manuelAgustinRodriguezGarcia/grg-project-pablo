import { binaryFileResponse } from "@/server/api/binary-file-response";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { billingDebtorsService } from "@/server/services/billing-debtors.service";
import type { DebtorSortOrder } from "@/features/billing/utils/invoice-list";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sortParam = url.searchParams.get("sort");
    const sort: DebtorSortOrder = sortParam === "asc" ? "asc" : "desc";

    const payload = await billingDebtorsService.generateXlsx({
      query: url.searchParams.get("query") ?? "",
      fromDate: url.searchParams.get("from") ?? "",
      toDate: url.searchParams.get("to") ?? "",
      sort,
    });

    return binaryFileResponse(
      payload.bytes,
      payload.filename,
      XLSX_TYPE,
      "attachment",
    );
  } catch (error) {
    return handleAdminApiError(error);
  }
}
