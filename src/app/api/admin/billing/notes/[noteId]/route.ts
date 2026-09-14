import { notePdfHttpResponse } from "@/server/api/billing-document-pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ noteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { noteId } = await context.params;
  return notePdfHttpResponse(request, noteId);
}
