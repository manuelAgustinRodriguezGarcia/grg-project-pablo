import { invoicePdfHttpResponse } from "@/server/api/billing-document-pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { invoiceId } = await context.params;
  return invoicePdfHttpResponse(request, invoiceId);
}
