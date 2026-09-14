import { receiptPdfHttpResponse } from "@/server/api/billing-document-pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ receiptId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { receiptId } = await context.params;
  return receiptPdfHttpResponse(request, receiptId);
}
