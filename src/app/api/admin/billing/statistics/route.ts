import { NextResponse } from "next/server";
import { handleAdminApiError } from "@/server/api/admin-api-error";
import { billingStatisticsService } from "@/server/services/billing-statistics.service";

export async function GET(request: Request) {
  try {
    const payload = await billingStatisticsService.getSummary(
      new URL(request.url).searchParams,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleAdminApiError(error);
  }
}
